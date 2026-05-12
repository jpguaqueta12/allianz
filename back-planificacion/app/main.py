from __future__ import annotations
from contextlib import asynccontextmanager
import structlog
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.config import get_settings
from app.db.connection import init_pool, close_pool
from app.db.connection import get_pool
from app.db.metadata import ensure_operational_schema
from app.services.cache_service import CacheService
from app.api.v1 import chat, config, estimation, health, upload
from app.api.v1 import auth as auth_router

logger = structlog.get_logger()


@asynccontextmanager
async def lifespan(app: FastAPI):
    s = get_settings()
    logger.info("starting", app=s.app_name, version=s.app_version)

    await init_pool()
    await ensure_operational_schema(get_pool())
    logger.info("db_pool_ready")

    cache = CacheService(s.redis_url)
    await cache.connect()
    app.state.cache = cache
    CacheService._instance = cache
    logger.info("cache_ready", mode="redis" if not cache._use_memory else "memory")

    yield

    await close_pool()
    await cache.disconnect()
    logger.info("shutdown")


def create_app() -> FastAPI:
    s = get_settings()
    app = FastAPI(
        title=s.app_name,
        version=s.app_version,
        docs_url="/docs" if s.debug else None,
        lifespan=lifespan,
    )

    app.add_middleware(
        CORSMiddleware,
        allow_origins=s.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    app.include_router(health.router,       prefix="/api/v1", tags=["health"])
    app.include_router(auth_router.router,  prefix="/api/v1", tags=["auth"])
    app.include_router(chat.router,         prefix="/api/v1", tags=["chat"])
    app.include_router(config.router,       prefix="/api/v1", tags=["config"])
    app.include_router(estimation.router,   prefix="/api/v1", tags=["estimation"])
    app.include_router(upload.router,       prefix="/api/v1", tags=["upload"])

    return app


app = create_app()
