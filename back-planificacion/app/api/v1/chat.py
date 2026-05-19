from __future__ import annotations
import asyncio
import json
import uuid
from datetime import date
from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import StreamingResponse
from langchain_core.messages import HumanMessage, AIMessage

from app.agent.graph import get_graph
from app.models.requests import (
    ChatRequest,
    InitSessionRequest,
    PlanificacionRequest,
    FechaAsignacionRequest,
    FechaComprometidaClienteRequest,
    FechaFinalizacionRequest,
    EscalamientoRequest,
    StatusRequest,
    CreateBacklogRequest,
)
from app.models.responses import SessionResponse, ChatStartResponse
from app.services.cache_service import CacheService

router = APIRouter()

SESSION_TTL = 3600 * 8  # 8 horas


def _default(obj):
    if isinstance(obj, date):
        return obj.isoformat()
    raise TypeError


# ─── SESIÓN ───────────────────────────────────────────────────────────────────

@router.post("/session", response_model=SessionResponse)
async def create_session(body: InitSessionRequest):
    session_id = str(uuid.uuid4())
    cache = CacheService.get_instance()
    await cache.set(f"session:{session_id}", {"messages": [], "user": body.user}, ttl=SESSION_TTL)
    return SessionResponse(session_id=session_id)


# ─── CHAT ─────────────────────────────────────────────────────────────────────

@router.post("/chat", response_model=ChatStartResponse)
async def start_chat(body: ChatRequest):
    cache = CacheService.get_instance()
    session = await cache.get(f"session:{body.session_id}")
    if not session:
        raise HTTPException(status_code=404, detail="Sesión no encontrada")

    stream_channel = f"chat:{body.session_id}"
    history = _deserialize_history(session.get("messages", []))
    history.append(HumanMessage(content=body.message))
    asyncio.create_task(_run_agent(body.session_id, history, stream_channel, body.message))

    return ChatStartResponse(
        session_id=body.session_id,
        stream_url=f"/api/v1/stream/{body.session_id}",
    )


@router.get("/stream/{session_id}")
async def stream_chat(session_id: str):
    cache = CacheService.get_instance()
    subscriber = await cache.subscribe_sse(f"chat:{session_id}")

    async def generator():
        timeout = 120
        idle = 0
        while idle < timeout:
            if isinstance(subscriber, asyncio.Queue):
                try:
                    payload = subscriber.get_nowait()
                    yield f"data: {payload}\n\n"
                    idle = 0
                    if _is_terminal(payload):
                        break
                except asyncio.QueueEmpty:
                    idle += 1
                    await asyncio.sleep(0.1)
            else:
                msg = await subscriber.get_message(ignore_subscribe_messages=True, timeout=1.0)
                if msg and msg["type"] == "message":
                    payload = msg["data"]
                    yield f"data: {payload}\n\n"
                    idle = 0
                    if _is_terminal(payload):
                        break
                else:
                    idle += 1
                    await asyncio.sleep(0)

    return StreamingResponse(
        generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
            "Connection": "keep-alive",
        },
    )


# ─── DASHBOARD DATA ───────────────────────────────────────────────────────────

_NO_PI_MSG = "No hay un PI activo configurado. Ve a Configuración → PI, crea un PI y actívalo."


@router.get("/dashboard")
async def get_dashboard(pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    pi = await Q.get_pi_by_id(pool, pi_id) if pi_id else await Q.get_pi_activo(pool, 'MEJORA_CONTINUA')
    if not pi:
        raise HTTPException(status_code=404, detail=_NO_PI_MSG)
    capacidad, proyectos = await asyncio.gather(
        Q.get_capacidad_personas(pool, 'MEJORA_CONTINUA', pi["id"]),
        Q.get_resumen_proyectos(pool, 'MEJORA_CONTINUA', pi["id"]),
    )
    return {
        "capacidad": capacidad,
        "resumen_proyectos": proyectos,
        "pi_activo": pi,
    }


@router.get("/dashboard/fabrica")
async def get_dashboard_fabrica(pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    pi = await Q.get_pi_by_id(pool, pi_id) if pi_id else await Q.get_pi_activo(pool, 'MEJORA_CONTINUA')
    if not pi:
        raise HTTPException(status_code=404, detail=_NO_PI_MSG)
    capacidad, proyectos = await asyncio.gather(
        Q.get_capacidad_personas(pool, 'MEJORA_CONTINUA', pi["id"]),
        Q.get_resumen_proyectos(pool, 'FABRICA', pi["id"]),
    )
    return {
        "capacidad": capacidad,
        "resumen_proyectos": proyectos,
        "pi_activo": pi,
    }


@router.get("/dashboard/incidentes")
async def get_dashboard_incidentes():
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    capacidad, proyectos, pi_activo = await asyncio.gather(
        Q.get_capacidad_personas(pool, 'INCIDENTES'),
        Q.get_resumen_proyectos(pool, 'INCIDENTES'),
        Q.get_pi_activo(pool, 'INCIDENTES'),
    )
    return {
        "capacidad": capacidad,
        "resumen_proyectos": proyectos,
        "pi_activo": pi_activo,
    }


# ─── BACKLOG ─────────────────────────────────────────────────────────────────

@router.get("/backlog/{modulo}/responsables")
async def get_responsables(modulo: str, pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_responsables_disponibles(get_pool(), modulo.upper(), pi_id)


@router.post("/backlog/{modulo}")
async def create_backlog(modulo: str, body: CreateBacklogRequest, pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    mod = modulo.upper()
    if mod not in ("MEJORA_CONTINUA", "FABRICA"):
        raise HTTPException(status_code=400, detail="Módulo no soportado para backlog manual")
    selected_pi_id = pi_id
    if selected_pi_id is None:
        pi_modulo = 'MEJORA_CONTINUA' if mod == 'FABRICA' else mod
        selected_pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo=$1 LIMIT 1", pi_modulo
        )
    if not selected_pi_id:
        raise HTTPException(status_code=404, detail=_NO_PI_MSG)
    try:
        return await Q.create_backlog_item(pool, mod, selected_pi_id, body.model_dump())
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))


@router.put("/backlog/{modulo}/{ticket_id}/planificacion")
async def update_planificacion(modulo: str, ticket_id: int, body: PlanificacionRequest):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    await Q.update_planificacion(pool, modulo.upper(), ticket_id, body.model_dump())
    return {"ok": True}


@router.patch("/backlog/{modulo}/{ticket_id}/fecha-asignacion")
async def update_fecha_asignacion(modulo: str, ticket_id: int, body: FechaAsignacionRequest):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    fecha_fin, fecha_fin_inicial = await Q.update_fecha_asignacion(pool, modulo.upper(), ticket_id, body.fecha_asignacion)
    return {
        "ok": True,
        "fecha_finalizacion": fecha_fin.isoformat() if fecha_fin else None,
        "fecha_finalizacion_inicial": fecha_fin_inicial.isoformat() if fecha_fin_inicial else None,
    }


@router.patch("/backlog/{modulo}/{ticket_id}/fecha-finalizacion")
async def update_fecha_finalizacion(modulo: str, ticket_id: int, body: FechaFinalizacionRequest):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    try:
        fecha_fin = await Q.update_fecha_finalizacion(pool, modulo.upper(), ticket_id, body.fecha_finalizacion)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "ok": True,
        "fecha_finalizacion": fecha_fin.isoformat() if fecha_fin else None,
    }


@router.patch("/backlog/{modulo}/{ticket_id}/fecha-comprometida-cliente")
async def update_fecha_comprometida_cliente(modulo: str, ticket_id: int, body: FechaComprometidaClienteRequest):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    try:
        fecha = await Q.update_fecha_comprometida_cliente(pool, modulo.upper(), ticket_id, body.fecha_finalizacion_inicial)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "ok": True,
        "fecha_finalizacion_inicial": fecha.isoformat() if fecha else None,
    }


@router.patch("/backlog/{modulo}/{ticket_id}/escalamiento")
async def update_escalamiento(modulo: str, ticket_id: int, body: EscalamientoRequest):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    try:
        updated = await Q.update_escalamiento(
            pool,
            modulo.upper(),
            ticket_id,
            [e.model_dump() for e in body.escalados],
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "ok": True,
        "escalados": updated["escalados"],
        "fecha_escalado": updated["fecha_escalado"].isoformat() if updated.get("fecha_escalado") else None,
        "fecha_reinicio": updated["fecha_reinicio"].isoformat() if updated.get("fecha_reinicio") else None,
        "fecha_finalizacion": updated["fecha_finalizacion"].isoformat() if updated.get("fecha_finalizacion") else None,
        "fecha_finalizacion_inicial": updated["fecha_finalizacion_inicial"].isoformat() if updated.get("fecha_finalizacion_inicial") else None,
        "etc": updated["etc"],
        "status": updated["status"],
    }


@router.patch("/backlog/{modulo}/{ticket_id}/status")
async def update_status(modulo: str, ticket_id: int, body: StatusRequest):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    try:
        updated = await Q.update_status(pool, modulo.upper(), ticket_id, body.status)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return {
        "ok": True,
        "status": updated["status"],
        "fecha_entrega": updated["fecha_entrega"].isoformat() if updated["fecha_entrega"] else None,
    }


@router.patch("/backlog/{modulo}/{ticket_id}/project")
async def update_project(modulo: str, ticket_id: int, body: dict):
    from app.db.connection import get_pool
    import app.db.queries as Q
    updated = await Q.update_backlog_project(get_pool(), modulo.upper(), ticket_id, body.get("project"))
    if not updated:
        raise HTTPException(status_code=404, detail="Ticket no encontrado")
    return {"ok": True, "project": body.get("project")}


@router.delete("/backlog/{modulo}/{ticket_id}")
async def delete_backlog(modulo: str, ticket_id: int):
    from app.db.connection import get_pool
    import app.db.queries as Q
    mod = modulo.upper()
    if mod not in ("MEJORA_CONTINUA", "FABRICA"):
        raise HTTPException(status_code=400, detail="Módulo no soportado para eliminar backlog")
    deleted = await Q.delete_backlog_item(get_pool(), mod, ticket_id)
    if not deleted:
        raise HTTPException(status_code=404, detail="Elemento de backlog no encontrado")
    return {"deleted": True, "id": ticket_id}


@router.get("/alertas/{modulo}")
async def get_alertas(modulo: str, pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_alertas(get_pool(), modulo.upper(), pi_id)


@router.get("/alertas-sin-asignacion/{modulo}")
async def get_alertas_sin_asignacion(modulo: str, pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_alertas_sin_asignacion(get_pool(), modulo.upper(), pi_id)


@router.get("/sla/{modulo}")
async def get_sla(modulo: str, pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    return await Q.get_sla_report(get_pool(), modulo.upper(), pi_id)


@router.get("/backlog/{modulo}")
async def get_backlog(modulo: str, pi_id: Optional[int] = Query(default=None)):
    from app.db.connection import get_pool
    import app.db.queries as Q
    pool = get_pool()
    mod = modulo.upper()
    if mod == "INCIDENTES":
        pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo='INCIDENTES' LIMIT 1"
        )
        if not pi_id:
            raise HTTPException(status_code=404, detail=_NO_PI_MSG)
        return await Q.get_backlog_incidentes(pool, pi_id)
    selected_pi_id = pi_id
    if selected_pi_id is None:
        # FABRICA comparte PI activo con MEJORA_CONTINUA
        pi_modulo = 'MEJORA_CONTINUA' if mod == 'FABRICA' else mod
        selected_pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo=$1 LIMIT 1", pi_modulo
        )
    if not selected_pi_id:
        raise HTTPException(status_code=404, detail=_NO_PI_MSG)
    return await Q.get_backlog(pool, mod, selected_pi_id)


# ─── HELPERS ──────────────────────────────────────────────────────────────────

async def _run_agent(session_id: str, history: list, channel: str, user_message: str):
    cache = CacheService.get_instance()
    graph = get_graph()
    full_response = ""

    try:
        async for event in graph.astream_events(
            {"messages": history, "session_id": session_id},
            version="v2",
        ):
            kind = event["event"]
            name = event.get("name", "")

            if kind == "on_chat_model_stream":
                chunk = event["data"]["chunk"]
                token = chunk.content
                if token:
                    full_response += token
                    await cache.publish_sse(channel, {"type": "token", "content": token})

            elif kind == "on_chain_stream" and name == "agent":
                chunk = event.get("data", {}).get("chunk", {})
                msgs = chunk.get("messages", [])
                if msgs and not full_response:
                    content = getattr(msgs[-1], "content", "") or ""
                    if content and isinstance(content, str):
                        full_response = content
                        await cache.publish_sse(channel, {"type": "token", "content": content})

            elif kind == "on_tool_start":
                tool_input = event["data"].get("input", {})
                await cache.publish_sse(channel, {
                    "type": "tool_start",
                    "tool": name,
                    "input": tool_input,
                })

            elif kind == "on_tool_end":
                output = event["data"].get("output", "")
                await cache.publish_sse(channel, {
                    "type": "tool_end",
                    "tool": name,
                    "output": str(output)[:500],
                })

        session = await cache.get(f"session:{session_id}")
        if session is not None:
            msgs = session.get("messages", [])
            msgs.append({"role": "user", "content": user_message})
            msgs.append({"role": "assistant", "content": full_response})
            await cache.set(f"session:{session_id}", {**session, "messages": msgs}, ttl=SESSION_TTL)

        await cache.publish_sse(channel, {"type": "complete", "full_response": full_response})

    except Exception as e:
        await cache.publish_sse(channel, {"type": "error", "message": str(e)})


def _deserialize_history(raw: list) -> list:
    messages = []
    for m in raw:
        if m["role"] == "user":
            messages.append(HumanMessage(content=m["content"]))
        elif m["role"] == "assistant":
            messages.append(AIMessage(content=m["content"]))
    return messages


def _is_terminal(payload: str) -> bool:
    try:
        data = json.loads(payload)
        return data.get("type") in ("complete", "error")
    except Exception:
        return False
