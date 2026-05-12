from fastapi import APIRouter
from app.config import get_settings
from app.db.connection import get_pool
from app.services.cache_service import CacheService

router = APIRouter()


@router.get("/health")
async def health():
    checks = {}
    try:
        pool = get_pool()
        await pool.fetchval("SELECT 1")
        checks["db"] = "ok"
        pi = await pool.fetchrow("""
            SELECT nombre, fecha_inicio, fecha_fin
            FROM pi
            WHERE activo = TRUE
            LIMIT 1
        """)
        checks["pi_activo"] = dict(pi) if pi else None
        latest = await pool.fetchrow("""
            SELECT filename, status, applied_at
            FROM excel_import_batches
            WHERE status = 'APPLIED'
            ORDER BY applied_at DESC NULLS LAST, created_at DESC
            LIMIT 1
        """)
        checks["ultima_carga_aplicada"] = dict(latest) if latest else None
    except Exception as e:
        checks["db"] = str(e)

    try:
        cache = CacheService.get_instance()
        checks["cache"] = "memory" if cache._use_memory else "redis"
    except Exception as e:
        checks["cache"] = str(e)

    settings = get_settings()
    checks["azure_openai_configurado"] = bool(
        settings.azure_openai_endpoint
        and settings.azure_openai_api_key
        and settings.azure_openai_deployment
    )
    status = "ok" if checks.get("db") == "ok" and checks.get("azure_openai_configurado") else "degraded"
    return {"status": status, **checks}
