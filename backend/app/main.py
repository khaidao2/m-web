"""
PG-NEXUS FastAPI Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from prometheus_fastapi_instrumentator import Instrumentator
import time
import uuid

from app.core.config import get_settings
from app.core.logging import configure_logging, logger
from app.api import health, users, passport, quizzes, voice, leaderboard, quests

settings = get_settings()
configure_logging(debug=settings.debug)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("PG-NEXUS API starting", version=settings.app_version, env=settings.environment)
    yield
    logger.info("PG-NEXUS API shutting down")


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description="PG-NEXUS: Digital Passport & AI Voice Simulator 360° for Masan Consumer PG",
    lifespan=lifespan,
    docs_url="/api/docs" if settings.debug else None,
    redoc_url="/api/redoc" if settings.debug else None,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Request logging middleware
@app.middleware("http")
async def log_requests(request: Request, call_next):
    request_id = str(uuid.uuid4())[:8]
    start = time.time()
    response = await call_next(request)
    duration = round((time.time() - start) * 1000)
    logger.info(
        "request",
        id=request_id,
        method=request.method,
        path=request.url.path,
        status=response.status_code,
        duration_ms=duration,
    )
    response.headers["X-Request-ID"] = request_id
    return response


# Prometheus metrics
Instrumentator().instrument(app).expose(app, endpoint="/metrics")

# Routers
app.include_router(health.router, prefix="/api/v1", tags=["health"])
app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
app.include_router(passport.router, prefix="/api/v1", tags=["passport"])
app.include_router(quizzes.router, prefix="/api/v1", tags=["quizzes"])
app.include_router(voice.router, prefix="/api/v1", tags=["voice"])
app.include_router(leaderboard.router, prefix="/api/v1", tags=["leaderboard"])
app.include_router(quests.router, prefix="/api/v1", tags=["quests"])


@app.get("/health", tags=["root"])
async def root_health():
    return {"status": "ok", "version": settings.app_version, "service": "pgnexus-api"}
