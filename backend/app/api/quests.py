from datetime import datetime
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.db.database import get_db
from app.models.models import User
from app.services.content import COMPETENCIES, scenario_public, scenarios
from app.services.passport import todays_quests

router = APIRouter()
VN = ZoneInfo("Asia/Ho_Chi_Minh")


@router.get("/quests/today")
async def today(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    quests = await todays_quests(db, user, datetime.now(VN).date())
    return [
        {
            "id": q.id,
            "day": q.day,
            "kind": "red_flag" if q.red_flag_id else "daily",
            "competency": q.competency,
            "competency_name": COMPETENCIES[q.competency][0] if q.competency else None,
            "scenario": scenario_public(scenarios()[q.scenario_code]),
            "done": q.completed_at is not None,
            "session_id": q.session_id,
        }
        for q in quests
    ]
