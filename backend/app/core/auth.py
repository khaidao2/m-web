"""JWT / Keycloak token verification"""
from typing import Optional, Dict, Any
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import httpx
from jose import jwt, JWTError
from app.core.config import get_settings
from app.core.logging import logger

security = HTTPBearer()
settings = get_settings()

_jwks_cache: Optional[Dict] = None


async def get_jwks() -> Dict:
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    async with httpx.AsyncClient() as client:
        try:
            resp = await client.get(settings.oidc_jwks_url, timeout=10)
            resp.raise_for_status()
            _jwks_cache = resp.json()
            return _jwks_cache
        except Exception as e:
            logger.error("Failed to fetch JWKS", error=str(e))
            raise HTTPException(status_code=503, detail="Auth service unavailable")


async def verify_token(
    credentials: HTTPAuthorizationCredentials = Depends(security)
) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        jwks = await get_jwks()
        payload = jwt.decode(
            token,
            jwks,
            algorithms=["RS256"],
            options={"verify_aud": False},
        )
        return payload
    except JWTError as e:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        )


async def get_current_user_info(payload: Dict = Depends(verify_token)) -> Dict:
    return {
        "keycloak_id": payload.get("sub"),
        "email": payload.get("email", ""),
        "full_name": payload.get("name", ""),
        "role": payload.get("realm_access", {}).get("roles", ["pg"])[0],
    }


def require_role(*roles: str):
    async def check_role(payload: Dict = Depends(verify_token)):
        user_roles = payload.get("realm_access", {}).get("roles", [])
        if not any(r in user_roles for r in roles):
            raise HTTPException(status_code=403, detail="Insufficient permissions")
        return payload
    return check_role
