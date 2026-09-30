"""Keycloak access-token verification and the current-user dependency."""
import asyncio
from dataclasses import dataclass

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import get_settings
from app.db.database import get_db
from app.models.models import User, UserRole

bearer = HTTPBearer(auto_error=False)
_jwks: jwt.PyJWKClient | None = None


@dataclass
class TokenClaims:
    sub: str
    username: str
    full_name: str
    role: UserRole


def _jwks_client() -> jwt.PyJWKClient:
    global _jwks
    if _jwks is None:
        _jwks = jwt.PyJWKClient(get_settings().keycloak_jwks_url, cache_keys=True, lifespan=3600)
    return _jwks


def _unauthorized(detail: str) -> HTTPException:
    return HTTPException(status.HTTP_401_UNAUTHORIZED, detail, headers={"WWW-Authenticate": "Bearer"})


async def verify_token(creds: HTTPAuthorizationCredentials | None = Depends(bearer)) -> TokenClaims:
    if creds is None:
        raise _unauthorized("Chưa đăng nhập")
    token = creds.credentials
    try:
        key = await asyncio.to_thread(_jwks_client().get_signing_key_from_jwt, token)
        payload = jwt.decode(
            token,
            key.key,
            algorithms=["RS256"],
            issuer=get_settings().keycloak_issuer,
            options={"verify_aud": False},
        )
    except jwt.PyJWKClientError as exc:
        raise HTTPException(status.HTTP_503_SERVICE_UNAVAILABLE, "Dịch vụ đăng nhập chưa sẵn sàng") from exc
    except jwt.InvalidTokenError as exc:
        raise _unauthorized("Phiên đăng nhập không hợp lệ") from exc

    roles = set(payload.get("realm_access", {}).get("roles", []))
    role = UserRole.SUPERVISOR if "supervisor" in roles else UserRole.PG
    if "pg" not in roles and role is UserRole.PG:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Tài khoản chưa được cấp quyền PG-NEXUS")
    return TokenClaims(
        sub=payload["sub"],
        username=payload.get("preferred_username", ""),
        full_name=_vietnamese_name(payload),
        role=role,
    )


def _vietnamese_name(payload: dict) -> str:
    """Vietnamese order is họ + tên; Keycloak's `name` claim is given-first."""
    parts = [payload.get("family_name", ""), payload.get("given_name", "")]
    return " ".join(p for p in parts if p).strip() or payload.get("name") or payload.get("preferred_username", "")


async def current_user(
    claims: TokenClaims = Depends(verify_token), db: AsyncSession = Depends(get_db)
) -> User:
    """Returns the local profile for the token subject, creating or syncing it from Keycloak."""
    user = await db.scalar(select(User).where(User.keycloak_sub == claims.sub))
    if user is None:
        user = User(keycloak_sub=claims.sub, username=claims.username, full_name=claims.full_name, role=claims.role)
        db.add(user)
        await db.flush()
    elif (user.full_name, user.role, user.username) != (claims.full_name, claims.role, claims.username):
        user.full_name, user.role, user.username = claims.full_name, claims.role, claims.username
    return user


async def current_supervisor(user: User = Depends(current_user)) -> User:
    if user.role is not UserRole.SUPERVISOR:
        raise HTTPException(status.HTTP_403_FORBIDDEN, "Chỉ dành cho Sales Supervisor")
    return user
