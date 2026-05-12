from __future__ import annotations
import asyncpg
from app.config import get_settings

_pool: asyncpg.Pool | None = None


async def init_pool():
    global _pool
    s = get_settings()
    _pool = await asyncpg.create_pool(
        host=s.db_host,
        port=s.db_port,
        database=s.db_name,
        user=s.db_user,
        password=s.db_password,
        min_size=2,
        max_size=10,
    )


async def close_pool():
    global _pool
    if _pool:
        await _pool.close()
        _pool = None


def get_pool() -> asyncpg.Pool:
    if _pool is None:
        raise RuntimeError("Pool no inicializado")
    return _pool
