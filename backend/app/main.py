"""PG-NEXUS API — Digital Passport & AI Voice Simulator 360° for Masan Consumer PGs at BHX."""
import asyncio
from contextlib import asynccontextmanager

from fastapi import FastAPI

from app.api import bills, health, leaderboard, passport, quests, quizzes, supervisor, users, voice
from app.core.config import get_settings
from app.core.logging import configure_logging
from app.services import tts

settings = get_settings()
configure_logging(settings.debug)



@asynccontextmanager
async def lifespan(_: FastAPI):
    warming = asyncio.create_task(asyncio.to_thread(tts.warm))  # don't block startup on the voice model
    yield
    warming.cancel()


app = FastAPI(
    lifespan=lifespan,
    title=settings.app_name,
    version=settings.app_version,
    docs_url="/api/docs" if settings.debug else None,
    openapi_url="/api/openapi.json" if settings.debug else None,
)

for module in (health, users, passport, quizzes, voice, quests, leaderboard, supervisor, bills):
    app.include_router(module.router, prefix="/api/v1")
