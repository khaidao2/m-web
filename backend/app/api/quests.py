from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.db.database import get_db
from app.models.models import DailyQuest
from app.core.auth import verify_token, get_current_user_info
from app.api.users import get_or_create_user

router = APIRouter()


@router.get("/quests/today")
async def get_today_quests(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    # Get today's date bounds
    now = datetime.now(timezone.utc)
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
    today_end = today_start + timedelta(days=1)

    result = await db.execute(
        select(DailyQuest).where(
            DailyQuest.user_id == user.id,
            DailyQuest.assigned_date >= today_start,
            DailyQuest.assigned_date < today_end,
        ).order_by(DailyQuest.is_completed, DailyQuest.assigned_date)
    )
    quests = result.scalars().all()

    return [
        {
            "id": q.id,
            "title": q.title,
            "description": q.description,
            "target_competency": q.target_competency,
            "task_type": q.task_type,
            "task_id": q.task_id,
            "is_completed": q.is_completed,
            "assigned_date": q.assigned_date,
            "completed_at": q.completed_at,
        }
        for q in quests
    ]


@router.post("/quests/{quest_id}/complete")
async def complete_quest(
    quest_id: str,
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(DailyQuest).where(DailyQuest.id == quest_id, DailyQuest.user_id == user.id)
    )
    quest = result.scalar_one_or_none()
    if not quest:
        raise HTTPException(status_code=404, detail="Quest không tồn tại")

    quest.is_completed = True
    quest.completed_at = datetime.now(timezone.utc)
    await db.commit()
    return {"message": "Hoàn thành nhiệm vụ!", "quest_id": quest_id}
