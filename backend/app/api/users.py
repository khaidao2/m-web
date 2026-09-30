import uuid
from datetime import datetime, timezone
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel

from app.db.database import get_db
from app.models.models import User, PGPassport, UserRole
from app.core.auth import verify_token, get_current_user_info

router = APIRouter()


class UserUpdate(BaseModel):
    full_name: Optional[str] = None
    phone: Optional[str] = None
    store_code: Optional[str] = None
    region: Optional[str] = None


async def get_or_create_user(db: AsyncSession, user_info: dict) -> User:
    """Get or create user from Keycloak token claims."""
    keycloak_id = user_info["keycloak_id"]
    result = await db.execute(select(User).where(User.keycloak_id == keycloak_id))
    user = result.scalar_one_or_none()

    if not user:
        # Try by email first
        result = await db.execute(select(User).where(User.email == user_info["email"]))
        user = result.scalar_one_or_none()

        if user:
            user.keycloak_id = keycloak_id
        else:
            # Create new user
            role_str = user_info.get("role", "pg")
            try:
                role = UserRole(role_str)
            except ValueError:
                role = UserRole.PG

            user = User(
                id=str(uuid.uuid4()),
                keycloak_id=keycloak_id,
                email=user_info["email"],
                full_name=user_info.get("full_name", ""),
                role=role,
            )
            db.add(user)

        # Create empty passport for PG users
        if user.role == UserRole.PG:
            result = await db.execute(select(PGPassport).where(PGPassport.user_id == user.id))
            if not result.scalar_one_or_none():
                passport = PGPassport(id=str(uuid.uuid4()), user_id=user.id)
                db.add(passport)

        await db.commit()
        await db.refresh(user)

    return user


@router.get("/me")
async def get_me(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)
    return {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "phone": user.phone,
        "role": user.role,
        "store_code": user.store_code,
        "region": user.region,
        "is_active": user.is_active,
        "created_at": user.created_at,
    }


@router.put("/me")
async def update_me(
    data: UserUpdate,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    if data.full_name is not None:
        user.full_name = data.full_name
    if data.phone is not None:
        user.phone = data.phone
    if data.store_code is not None:
        user.store_code = data.store_code
    if data.region is not None:
        user.region = data.region

    await db.commit()
    await db.refresh(user)
    return {"message": "Cập nhật thành công", "user": {
        "id": user.id,
        "email": user.email,
        "full_name": user.full_name,
        "store_code": user.store_code,
        "region": user.region,
    }}
