"""
Catalyst Forge — FastAPI Main Application
"""
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.habits.router import router as habits_router
from app.auth.router import router as auth_router
from app.checkins.router import router as checkins_router
from app.triggers.router import router as triggers_router
from app.journal.router import router as journal_router
from app.ai.router import router as ai_router
from app.identity.router import router as identity_router
from app.notifications.router import router as notifications_router
from app.stats.router import router as stats_router


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown events."""
    settings = get_settings()
    print(f"[FIRE] {settings.app_name} v{settings.app_version} starting...")
    print(f"[DB] Supabase: {settings.supabase_url}")
    print(f"[AI] Model: {settings.gemini_model}")

    from app.workers.scheduler import start_workers, stop_workers
    await start_workers()

    yield

    await stop_workers()
    print(f"[STOP] {settings.app_name} shutting down...")


def create_app() -> FastAPI:
    settings = get_settings()

    app = FastAPI(
        title=settings.app_name,
        description="Forge yourself through fire. Personal transformation portal.",
        version=settings.app_version,
        lifespan=lifespan,
        docs_url=f"{settings.api_prefix}/docs",
        redoc_url=f"{settings.api_prefix}/redoc",
        openapi_url=f"{settings.api_prefix}/openapi.json",
    )

    # CORS - ALLOW ALL FOR DEV STABILITY
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    # Health check
    @app.get("/health")
    async def health_check():
        return {
            "status": "alive",
            "app": settings.app_name,
            "version": settings.app_version,
            "message": "Stay hard. 🔥",
        }

    # Register routers
    prefix = settings.api_prefix
    app.include_router(auth_router, prefix=f"{prefix}/auth", tags=["Auth"])
    app.include_router(habits_router, prefix=f"{prefix}/habits", tags=["Habits"])
    app.include_router(triggers_router, prefix=f"{prefix}/triggers", tags=["Triggers"])
    app.include_router(checkins_router, prefix=f"{prefix}/checkins", tags=["Check-ins"])
    app.include_router(journal_router, prefix=f"{prefix}/journal", tags=["Journal"])
    app.include_router(ai_router, prefix=f"{prefix}/ai", tags=["AI Analysis"])
    app.include_router(identity_router, prefix=f"{prefix}/identity", tags=["Identity"])
    app.include_router(
        notifications_router, prefix=f"{prefix}/notifications", tags=["Notifications"]
    )
    app.include_router(stats_router, prefix=f"{prefix}/stats", tags=["Stats"])

    return app


app = create_app()
