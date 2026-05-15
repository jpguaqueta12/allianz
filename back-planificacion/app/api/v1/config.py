from __future__ import annotations
from typing import Annotated
from fastapi import APIRouter, Depends, HTTPException
from app.auth.dependencies import require_superuser
from app.models.requests import (
    AddFestivoRequest,
    AddPersonaCapacidadRequest,
    AddProyectoCapacidadRequest,
    CreatePiRequest,
    NovedadDisponibilidadRequest,
    UpdatePersonaCapacidadRequest,
    UpdatePiRequest,
)

router = APIRouter()

# ── Alias de dependencia ───────────────────────────────────────────────────────
SuperUser = Annotated[dict, Depends(require_superuser)]


@router.get("/config/pis")
async def list_pis():
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_pis(get_pool())


@router.get("/config/pi-activo")
async def get_pi_activo():
    from app.db.connection import get_pool
    import app.db.queries as Q
    pi = await Q.get_pi_activo(get_pool())
    if not pi:
        raise HTTPException(status_code=404, detail="No hay PI activo")
    return pi


@router.post("/config/pis")
async def create_pi(body: CreatePiRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        return await Q.create_pi(
            get_pool(), body.nombre, body.fecha_inicio, body.fecha_fin,
            body.dias_laborables, body.horas_por_dia, body.descripcion,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.put("/config/pis/{pi_id}")
async def update_pi(pi_id: int, body: UpdatePiRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    result = await Q.update_pi(get_pool(), pi_id, body.model_dump(exclude_none=True))
    if not result:
        raise HTTPException(status_code=404, detail="PI no encontrado")
    return result


@router.delete("/config/pis/{pi_id}")
async def delete_pi(pi_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        result = await Q.delete_pi(get_pool(), pi_id)
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"No se pudo eliminar el PI: {e}")
    if not result:
        raise HTTPException(status_code=404, detail="PI no encontrado")
    return result


@router.post("/config/pis/{pi_id}/activar")
async def activar_pi(pi_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    result = await Q.activar_pi(get_pool(), pi_id)
    if not result:
        raise HTTPException(status_code=404, detail="PI no encontrado")
    # result incluye personas_copiadas y proyectos_copiados
    return result


@router.get("/config/pis/{pi_id}/capacidad-resumen")
async def capacidad_resumen(pi_id: int):
    from app.db.connection import get_pool
    pool = get_pool()
    personas  = await pool.fetchval("SELECT COUNT(*) FROM capacidad_persona_pi WHERE pi_id=$1", pi_id) or 0
    proyectos = await pool.fetchval("SELECT COUNT(*) FROM capacidad_proyecto_pi WHERE pi_id=$1", pi_id) or 0
    return {"personas": int(personas), "proyectos": int(proyectos)}


@router.post("/config/pis/{pi_id}/capacidad/nueva-persona")
async def nueva_persona_capacidad(pi_id: int, body: AddPersonaCapacidadRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        return await Q.crear_y_agregar_persona(
            get_pool(), pi_id, body.nombre, body.apellidos, body.tecnologia,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.post("/config/pis/{pi_id}/capacidad/sincronizar")
async def sincronizar_capacidad(pi_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        return await Q.sincronizar_capacidad_a_pi(get_pool(), pi_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))


@router.delete("/config/pis/{pi_id}/capacidad/personas/{persona_id}")
async def remove_persona_capacidad(pi_id: int, persona_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    deleted = await Q.remove_persona_de_capacidad(get_pool(), pi_id, persona_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Persona no encontrada en la capacidad de este PI")
    return {"success": True}


@router.patch("/config/pis/{pi_id}/capacidad/personas/{persona_id}")
async def update_persona_capacidad(pi_id: int, persona_id: int, body: UpdatePersonaCapacidadRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        updated = await Q.update_persona_capacidad(
            get_pool(), pi_id, persona_id, body.model_dump(exclude_unset=True),
        )
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    if not updated:
        raise HTTPException(status_code=404, detail="Persona no encontrada en la capacidad de este PI")
    return updated


@router.get("/config/pis/{pi_id}/novedades")
async def get_novedades(pi_id: int):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_novedades_disponibilidad(get_pool(), pi_id)


@router.post("/config/pis/{pi_id}/novedades")
async def add_novedad(pi_id: int, body: NovedadDisponibilidadRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        return await Q.create_novedad_disponibilidad(get_pool(), pi_id, body.model_dump())
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/config/pis/{pi_id}/novedades/{novedad_id}")
async def delete_novedad(pi_id: int, novedad_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    deleted = await Q.delete_novedad_disponibilidad(get_pool(), pi_id, novedad_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Novedad no encontrada")
    return {"success": True}


@router.post("/config/pis/{pi_id}/proyectos/nuevo")
async def nuevo_proyecto_capacidad(pi_id: int, body: AddProyectoCapacidadRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    try:
        return await Q.crear_y_agregar_proyecto(
            get_pool(), pi_id, body.nombre, body.identi, body.modulo,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))


@router.delete("/config/pis/{pi_id}/proyectos/{proyecto_id}")
async def remove_proyecto_capacidad(pi_id: int, proyecto_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    deleted = await Q.remove_proyecto_de_capacidad(get_pool(), pi_id, proyecto_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Proyecto no encontrado en la capacidad de este PI")
    return {"success": True}


@router.get("/config/pis/{pi_id}/festivos")
async def get_festivos(pi_id: int):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_festivos_pi(get_pool(), pi_id)


@router.post("/config/pis/{pi_id}/festivos")
async def add_festivo(pi_id: int, body: AddFestivoRequest, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.add_festivo(get_pool(), pi_id, body.fecha, body.nombre)


@router.delete("/config/pis/{pi_id}/festivos/{festivo_id}")
async def delete_festivo(pi_id: int, festivo_id: int, _: SuperUser):
    from app.db.connection import get_pool
    import app.db.queries as Q
    deleted = await Q.delete_festivo(get_pool(), festivo_id, pi_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Festivo no encontrado")
    return {"success": True}
