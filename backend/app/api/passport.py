import uuid
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import User, PGPassport, UserRole
from app.core.auth import verify_token, get_current_user_info
from app.api.users import get_or_create_user

router = APIRouter()

COMPETENCY_FIELDS = ["c1_approach", "c2_discovery", "c3_storytelling",
                     "c4_expansion", "c5_objection", "c6_negotiation", "c7_discipline"]


def compute_passport_metrics(passport: PGPassport) -> dict:
    scores = {k: getattr(passport, k) for k in COMPETENCY_FIELDS}
    overall = sum(scores.values()) / 7 if any(v > 0 for v in scores.values()) else 0.0
    red_flags = [k for k, v in scores.items() if 0 < v < 2.0]
    return {"overall_score": round(overall, 2), "red_flags": red_flags}


async def get_or_create_passport(db: AsyncSession, user_id: str) -> PGPassport:
    result = await db.execute(select(PGPassport).where(PGPassport.user_id == user_id))
    passport = result.scalar_one_or_none()
    if not passport:
        passport = PGPassport(id=str(uuid.uuid4()), user_id=user_id)
        db.add(passport)
        await db.commit()
        await db.refresh(passport)
    return passport


@router.get("/passport")
async def get_my_passport(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)
    passport = await get_or_create_passport(db, user.id)
    metrics = compute_passport_metrics(passport)

    return {
        "id": passport.id,
        "user_id": passport.user_id,
        "scores": {k: getattr(passport, k) for k in COMPETENCY_FIELDS},
        "overall_score": metrics["overall_score"],
        "total_points": passport.total_points,
        "red_flags": metrics["red_flags"],
        "is_initialized": passport.is_initialized,
        "last_assessment_at": passport.last_assessment_at,
    }


@router.get("/passport/{user_id}")
async def get_user_passport(
    user_id: str,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    roles = payload.get("realm_access", {}).get("roles", [])
    if not any(r in roles for r in ["supervisor", "admin"]):
        raise HTTPException(status_code=403, detail="Chỉ Supervisor/Admin mới có quyền xem passport của PG khác")

    result = await db.execute(select(PGPassport).where(PGPassport.user_id == user_id))
    passport = result.scalar_one_or_none()
    if not passport:
        raise HTTPException(status_code=404, detail="Không tìm thấy passport")

    metrics = compute_passport_metrics(passport)
    return {
        "id": passport.id,
        "user_id": passport.user_id,
        "scores": {k: getattr(passport, k) for k in COMPETENCY_FIELDS},
        "overall_score": metrics["overall_score"],
        "total_points": passport.total_points,
        "red_flags": metrics["red_flags"],
        "is_initialized": passport.is_initialized,
    }


@router.post("/passport/initialize")
async def initialize_passport(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)
    passport = await get_or_create_passport(db, user.id)

    from datetime import datetime, timezone
    passport.is_initialized = True
    passport.last_assessment_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Khởi tạo passport thành công", "is_initialized": True}
