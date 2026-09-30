"""PG-NEXUS API — Digital Passport & AI Voice Simulator 360° for Masan Consumer PGs at BHX."""
from fastapi import FastAPI

from app.api import health, leaderboard, passport, quests, quizzes, supervisor, users, voice
from app.core.config import get_settings
from app.core.logging import configure_logging

settings = get_settings()
configure_logging(settings.debug)

app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

for module in (health, users, passport, quizzes, voice, quests, leaderboard, supervisor):
    app.include_router(module.router, prefix="/api/v1")
