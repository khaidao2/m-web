from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.db.database import get_db
from app.models.models import FlagStatus, PointsEntry, QuizAttempt, RedFlag, SessionKind, User, VoiceSession
from app.services.content import scenarios

router = APIRouter()


def onboarding_scenario(user: User) -> str:
    """The 7-minute entry roleplay: a full 5-step sale (BH group), fixed per PG."""
    codes = sorted(c for c, s in scenarios().items() if s["group"] == "full_sale")
    return codes[sum(map(ord, user.id)) % len(codes)]


async def onboarding_status(db: AsyncSession, user: User) -> dict:
    quiz_done = await db.scalar(select(QuizAttempt.id).where(
        QuizAttempt.user_id == user.id, QuizAttempt.completed_at.is_not(None)).limit(1))
    voice_done = await db.scalar(select(VoiceSession.id).where(
        VoiceSession.user_id == user.id, VoiceSession.kind == SessionKind.ONBOARDING,
        VoiceSession.completed_at.is_not(None)).limit(1))
    return {
        "quiz_done": quiz_done is not None,
        "voice_done": voice_done is not None,
        "voice_scenario": onboarding_scenario(user),
        "complete": quiz_done is not None and voice_done is not None,
    }


class ProfileIn(BaseModel):
    store_name: str = Field(min_length=2, max_length=200)


@router.patch("/me")
async def update_me(body: ProfileIn, user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    user.store_name = body.store_name.strip()
    return await me(user, db)


@router.get("/me")
async def me(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    points, days = (await db.execute(
        select(func.coalesce(func.sum(PointsEntry.points), 0), func.count(func.distinct(func.date(PointsEntry.created_at))))
        .where(PointsEntry.user_id == user.id)
    )).one()
    open_flags = await db.scalar(select(func.count(RedFlag.id)).where(
        RedFlag.user_id == user.id, RedFlag.status != FlagStatus.CLOSED))
    return {
        "stats": {"points": int(points), "days_learned": days, "open_flags": open_flags},
        "id": user.id,
        "username": user.username,
        "full_name": user.full_name,
        "role": user.role.value,
        "store_name": user.store_name,
        "onboarding": await onboarding_status(db, user),
    }
