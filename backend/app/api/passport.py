from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.auth import current_user
from app.db.database import get_db
from app.models.models import User
from app.services.passport import passport_view

router = APIRouter()


@router.get("/passport")
async def my_passport(user: User = Depends(current_user), db: AsyncSession = Depends(get_db)):
    return await passport_view(db, user)
