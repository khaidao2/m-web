import json
from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.db.database import get_db
from app.db.redis import get_redis
from app.models.models import User, PGPassport
from app.core.auth import verify_token, get_current_user_info
from app.api.users import get_or_create_user

router = APIRouter()
CACHE_KEY = "leaderboard:top50"
CACHE_TTL = 300  # 5 minutes


@router.get("/leaderboard")
async def get_leaderboard(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    redis = await get_redis()

    # Try cache first
    try:
        cached = await redis.get(CACHE_KEY)
        if cached:
            return json.loads(cached)
    except Exception:
        pass

    # Query top 50 by points
    result = await db.execute(
        select(User, PGPassport)
        .join(PGPassport, PGPassport.user_id == User.id)
        .where(User.is_active == True, PGPassport.total_points > 0)
        .order_by(PGPassport.total_points.desc())
        .limit(50)
    )
    rows = result.all()

    leaderboard = []
    for rank, (user, passport) in enumerate(rows, 1):
        leaderboard.append({
            "rank": rank,
            "user_id": user.id,
            "full_name": user.full_name,
            "store_code": user.store_code,
            "region": user.region,
            "total_points": passport.total_points,
            "overall_score": passport.overall_score,
        })

    # Cache it
    try:
        await redis.setex(CACHE_KEY, CACHE_TTL, json.dumps(leaderboard))
    except Exception:
        pass

    return leaderboard


@router.get("/leaderboard/me")
async def get_my_rank(
    payload: dict = Depends(verify_token),
    db: AsyncSession = Depends(get_db),
):
    user_info = await get_current_user_info(payload)
    user = await get_or_create_user(db, user_info)

    result = await db.execute(
        select(PGPassport).where(PGPassport.user_id == user.id)
    )
    passport = result.scalar_one_or_none()
    if not passport:
        return {"rank": None, "total_points": 0, "overall_score": 0.0}

    # Count users with more points
    rank_result = await db.execute(
        select(func.count(PGPassport.id)).where(PGPassport.total_points > passport.total_points)
    )
    rank = (rank_result.scalar() or 0) + 1

    return {
        "rank": rank,
        "total_points": passport.total_points,
        "overall_score": passport.overall_score,
        "red_flags": passport.red_flags,
    }
