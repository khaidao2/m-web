"""Bảng xếp hạng: points per period, change vs the previous period, what to improve / keep."""
from datetime import datetime, timedelta
from typing import Literal
from zoneinfo import ZoneInfo

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.db.database import get_db
from app.models.models import PointsEntry, User, UserRole
from app.services.content import COMPETENCIES, level_of
from app.services.passport import competency_scores, overall

router = APIRouter()
VN = ZoneInfo("Asia/Ho_Chi_Minh")
Period = Literal["week", "month", "quarter"]


def period_bounds(period: Period, now: datetime) -> tuple[datetime, datetime, datetime]:
    """(previous start, current start, current end) in Vietnam time."""
    day = now.astimezone(VN).replace(hour=0, minute=0, second=0, microsecond=0)
    if period == "week":
        start = day - timedelta(days=day.weekday())
        return start - timedelta(days=7), start, start + timedelta(days=7)
    months = 1 if period == "month" else 3
    first_month = day.month if period == "month" else 3 * ((day.month - 1) // 3) + 1
    start = day.replace(day=1, month=first_month)

    def shift(d: datetime, n: int) -> datetime:
        m = d.month - 1 + n
        return d.replace(year=d.year + m // 12, month=m % 12 + 1)

    return shift(start, -months), start, shift(start, months)


async def _totals(db: AsyncSession, start: datetime, end: datetime) -> dict[str, int]:
    rows = await db.execute(
        select(PointsEntry.user_id, func.sum(PointsEntry.points))
        .where(PointsEntry.created_at >= start, PointsEntry.created_at < end)
        .group_by(PointsEntry.user_id)
    )
    return {uid: int(total) for uid, total in rows.all()}


@router.get("/leaderboard")
async def leaderboard(period: Period = "week", user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    prev_start, start, end = period_bounds(period, datetime.now(VN))
    current, previous = await _totals(db, start, end), await _totals(db, prev_start, start)
    pgs = (await db.scalars(select(User).where(User.role == UserRole.PG))).all()
    ranked = sorted(pgs, key=lambda u: (-current.get(u.id, 0), u.full_name))

    entries = []
    for i, u in enumerate(ranked, start=1):
        pts, prev = current.get(u.id, 0), previous.get(u.id, 0)
        entries.append({
            "rank": i, "user_id": u.id, "name": u.full_name, "store": u.store_name, "points": pts,
            "change_pct": round(100 * (pts - prev) / prev) if prev else None,
            "is_me": u.id == user.id, "is_demo": u.is_demo,
        })

    me = next((e for e in entries if e["is_me"]), None)
    if me is not None:
        scores = await competency_scores(db, user.id)
        assessed = {c: v for c, v in scores.items() if v is not None}
        above = entries[me["rank"] - 2] if me["rank"] > 1 else None
        me = {
            **me,
            "previous_points": previous.get(user.id, 0),
            "total_pgs": len(entries),
            "gap_to_next": above["points"] - me["points"] if above else 0,
            "overall": overall(scores),
            "level": level_of(overall(scores)),
            "strongest": _comp(max(assessed, key=assessed.get), assessed) if assessed else None,
            "weakest": _comp(min(assessed, key=assessed.get), assessed) if assessed else None,
        }
    return {"period": period, "start": start, "end": end, "entries": entries, "me": me}


def _comp(key: str, scores: dict[str, float]) -> dict:
    return {"key": key, "name": COMPETENCIES[key][0], "score": scores[key]}
