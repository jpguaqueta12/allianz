"""
Tools LangChain que el agente puede invocar.
"""
from __future__ import annotations

import json
from datetime import date
from typing import Literal, Optional
from langchain_core.tools import tool
from app.db.connection import get_pool
import app.db.queries as Q

Modulo = Literal["MEJORA_CONTINUA", "FABRICA", "TODOS"]


def _serialize(obj):
    if isinstance(obj, date):
        return obj.isoformat()
    return str(obj)


def _fmt(data) -> str:
    return json.dumps(data, default=_serialize, ensure_ascii=False, indent=2)


def _normalize_modulo(modulo: Optional[str]) -> str:
    if not modulo:
        return "MEJORA_CONTINUA"
    value = modulo.strip().upper().replace(" ", "_").replace("Á", "A")
    if value in {"MC", "MEJORA", "MEJORA_CONTINUA", "MEJOR_CONTINUA"}:
        return "MEJORA_CONTINUA"
    if value in {"FABRICA", "FÁBRICA", "FA"}:
        return "FABRICA"
    if value in {"TODOS", "AMBOS", "ALL"}:
        return "TODOS"
    return "MEJORA_CONTINUA"


def _pi_modulo(modulo: str) -> str:
    return "MEJORA_CONTINUA" if modulo == "FABRICA" else modulo


async def _get_active_pi_id(pool, modulo: str) -> Optional[int]:
    return await pool.fetchval(
        "SELECT id FROM pi WHERE activo=TRUE AND modulo=$1 LIMIT 1",
        _pi_modulo(modulo),
    )


def _hours_by_profile(item: dict) -> dict[str, float]:
    java = cobol = dialogue = parametria = qa = 0.0
    plan_items = item.get("planificacion_items") or []
    if plan_items:
        for plan_item in plan_items:
            perfil = plan_item.get("perfil")
            horas = float(plan_item.get("horas") or 0)
            if perfil == "java":
                java += horas
            elif perfil == "cobol":
                cobol += horas
            elif perfil == "dialogue":
                dialogue += horas
            elif perfil == "parametria":
                parametria += horas
            elif perfil == "qa":
                qa += horas
    else:
        java = sum(float(item.get(k) or 0) for k in (
            "horas_analisis_java", "horas_desarrollo_java", "horas_pruebas_java", "horas_af_java"
        ))
        cobol = sum(float(item.get(k) or 0) for k in (
            "horas_analisis_cobol", "horas_desarrollo_cobol", "horas_pruebas_cobol", "horas_af_cobol"
        ))
        dialogue = sum(float(item.get(k) or 0) for k in (
            "horas_analisis_dialogue", "horas_desarrollo_dialogue", "horas_pruebas_dialogue", "horas_af_dialogue"
        ))
        parametria = sum(float(item.get(k) or 0) for k in (
            "horas_analisis_parametria", "horas_desarrollo_parametria",
            "horas_pruebas_parametria", "horas_af_parametria",
        ))
        qa = sum(float(item.get(k) or 0) for k in ("horas_analisis_qa", "horas_af_qa"))
    return {
        "java": round(java, 1),
        "cobol": round(cobol, 1),
        "dialogue": round(dialogue, 1),
        "parametria": round(parametria, 1),
        "qa": round(qa, 1),
    }


def _compact_backlog_item(item: dict) -> dict:
    hours = _hours_by_profile(item)
    responsables = {
        "java": item.get("responsable_java"),
        "cobol": item.get("responsable_cobol"),
        "dialogue": item.get("responsable_dialogue"),
        "parametria": item.get("responsable_parametria"),
        "qa": item.get("responsable_qa"),
    }
    return {
        "id": item.get("id"),
        "ticket_key": item.get("ticket_key"),
        "summary": item.get("summary"),
        "issue_type": item.get("issue_type"),
        "status": item.get("status"),
        "project": item.get("project"),
        "epic_link": item.get("epic_link"),
        "assigned_team": item.get("assigned_team"),
        "assignee": item.get("assignee"),
        "responsables": {k: v for k, v in responsables.items() if v},
        "horas_por_perfil": {k: v for k, v in hours.items() if v},
        "total_horas": item.get("total_horas"),
        "fecha_asignacion": item.get("fecha_asignacion"),
        "fecha_finalizacion": item.get("fecha_finalizacion"),
        "fecha_escalado": item.get("fecha_escalado"),
        "fecha_reinicio": item.get("fecha_reinicio"),
        "fecha_entrega": item.get("fecha_entrega"),
        "etc": item.get("etc"),
    }


async def _backlog_for_modulo(pool, modulo: str) -> list[dict]:
    pi_id = await _get_active_pi_id(pool, modulo)
    if not pi_id:
        return []
    return await Q.get_backlog(pool, modulo, pi_id)


def _counts_by(rows: list[dict], field: str) -> dict[str, int]:
    counts: dict[str, int] = {}
    for row in rows:
        key = row.get(field) or "SIN_DATO"
        counts[key] = counts.get(key, 0) + 1
    return dict(sorted(counts.items(), key=lambda kv: (-kv[1], kv[0])))


def _is_finalizado_status(status: str | None) -> bool:
    return (status or "").strip().lower() in {
        "finalizado",
        "finalizada",
        "finalizada qa",
        "done",
        "closed",
        "cerrado",
        "cerrada",
        "resuelto",
        "resolved",
    }


def _parse_date(value: object) -> Optional[date]:
    if isinstance(value, date):
        return value
    if not value:
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def _is_vencido(item: dict, today: date) -> bool:
    fecha_fin = _parse_date(item.get("fecha_finalizacion"))
    if not fecha_fin or fecha_fin >= today:
        return False
    if item.get("fecha_entrega") or _is_finalizado_status(item.get("status")):
        return False
    return True


def _compact_vencido_item(item: dict, today: date) -> dict:
    compact = _compact_backlog_item(item)
    fecha_fin = _parse_date(item.get("fecha_finalizacion"))
    compact["dias_vencido"] = (today - fecha_fin).days if fecha_fin else None
    return compact


# ─── CONSULTAS ────────────────────────────────────────────────────────────────

@tool
async def consultar_pi_activo(modulo: Modulo = "MEJORA_CONTINUA") -> str:
    """Consulta la configuración del PI activo: fechas, días laborables, horas por día, horas por persona y festivos."""
    mod = _normalize_modulo(modulo)
    if mod == "TODOS":
        data = {
            "MEJORA_CONTINUA": await Q.get_pi_activo(get_pool(), "MEJORA_CONTINUA"),
            "FABRICA": {
                "nota": "Fábrica comparte el PI activo, festivos y capacidad con Mejora Continua.",
                "pi": await Q.get_pi_activo(get_pool(), "MEJORA_CONTINUA"),
            },
        }
        return _fmt(data)
    return _fmt({
        "modulo": mod,
        "nota": "Fábrica comparte PI/capacidad con Mejora Continua." if mod == "FABRICA" else None,
        "pi": await Q.get_pi_activo(get_pool(), _pi_modulo(mod)),
    })


@tool
async def consultar_capacidad(modulo: Modulo = "MEJORA_CONTINUA") -> str:
    """Retorna capacidad por persona del PI activo: capacidad_horas, carga_estimada, horas_disponibles y estado."""
    mod = _normalize_modulo(modulo)
    pool = get_pool()
    if mod == "TODOS":
        rows = await Q.get_capacidad_personas(pool, "MEJORA_CONTINUA")
        return _fmt({
            "nota": "Mejora Continua y Fábrica comparten el PI y la capacidad de personas.",
            "capacidad": rows,
        })
    rows = await Q.get_capacidad_personas(pool, _pi_modulo(mod))
    return _fmt({
        "modulo": mod,
        "nota": "Fábrica usa la misma capacidad del PI activo de Mejora Continua." if mod == "FABRICA" else None,
        "capacidad": rows,
    })


@tool
async def consultar_resumen_proyectos(modulo: Modulo = "MEJORA_CONTINUA") -> str:
    """Retorna capacidad por proyecto del PI activo filtrada por módulo: cap_java_horas, cap_cobol_horas y alerta."""
    mod = _normalize_modulo(modulo)
    pool = get_pool()
    if mod == "TODOS":
        return _fmt({
            "MEJORA_CONTINUA": await Q.get_resumen_proyectos(pool, "MEJORA_CONTINUA"),
            "FABRICA": await Q.get_resumen_proyectos(pool, "FABRICA"),
        })
    return _fmt(await Q.get_resumen_proyectos(pool, mod))


@tool
async def consultar_backlog(
    modulo: Modulo = "MEJORA_CONTINUA",
    texto: Optional[str] = None,
    status: Optional[str] = None,
    limite: int = 20,
) -> str:
    """Consulta tickets del backlog actual por módulo. Permite filtrar por texto/ticket/resumen/épica/asignado/fechas y por status."""
    mod = _normalize_modulo(modulo)
    modules = ["MEJORA_CONTINUA", "FABRICA"] if mod == "TODOS" else [mod]
    pool = get_pool()
    result: dict[str, list[dict]] = {}
    q = (texto or "").strip().lower()
    status_q = (status or "").strip().lower()
    safe_limit = max(1, min(limite or 20, 50))

    for module in modules:
        rows = await _backlog_for_modulo(pool, module)
        filtered = []
        for item in rows:
            if status_q and status_q not in (item.get("status") or "").lower():
                continue
            if q:
                haystack = " ".join(str(item.get(k) or "") for k in (
                    "ticket_key", "summary", "epic_link", "assignee", "assigned_team", "project", "status",
                    "fecha_asignacion", "fecha_finalizacion", "fecha_escalado", "fecha_reinicio", "fecha_entrega",
                )).lower()
                if q not in haystack:
                    continue
            filtered.append(_compact_backlog_item(item))
        result[module] = filtered[:safe_limit]
    return _fmt(result)


@tool
async def consultar_ticket(ticket_key: str, modulo: Modulo = "TODOS") -> str:
    """Busca un ticket específico por key en Mejora Continua y/o Fábrica, con planificación, responsables, fechas, escalamiento y entrega."""
    mod = _normalize_modulo(modulo)
    modules = ["MEJORA_CONTINUA", "FABRICA"] if mod == "TODOS" else [mod]
    pool = get_pool()
    key = ticket_key.strip().upper()
    matches = []
    for module in modules:
        rows = await _backlog_for_modulo(pool, module)
        for item in rows:
            if (item.get("ticket_key") or "").upper() == key:
                compact = _compact_backlog_item(item)
                compact["modulo"] = module
                compact["planificacion_items"] = item.get("planificacion_items") or []
                matches.append(compact)
    return _fmt(matches)


@tool
async def consultar_alertas(modulo: Modulo = "MEJORA_CONTINUA") -> str:
    """Consulta alertas de desarrollo y QA calculadas desde fecha_asignacion, horas planificadas, festivos y PI activo."""
    mod = _normalize_modulo(modulo)
    pool = get_pool()
    if mod == "TODOS":
        return _fmt({
            "MEJORA_CONTINUA": await Q.get_alertas(pool, "MEJORA_CONTINUA"),
            "FABRICA": await Q.get_alertas(pool, "FABRICA"),
        })
    return _fmt(await Q.get_alertas(pool, mod))


@tool
async def consultar_vencidos(modulo: Modulo = "MEJORA_CONTINUA", limite: int = 50) -> str:
    """Lista tickets vencidos: fecha_finalizacion anterior a hoy, sin fecha_entrega y sin status finalizado/cerrado."""
    mod = _normalize_modulo(modulo)
    modules = ["MEJORA_CONTINUA", "FABRICA"] if mod == "TODOS" else [mod]
    pool = get_pool()
    today = date.today()
    safe_limit = max(1, min(limite or 50, 100))
    result: dict[str, dict] = {}

    for module in modules:
        backlog = await _backlog_for_modulo(pool, module)
        vencidos = [_compact_vencido_item(item, today) for item in backlog if _is_vencido(item, today)]
        vencidos.sort(key=lambda item: (-(item.get("dias_vencido") or 0), item.get("ticket_key") or ""))
        result[module] = {
            "fecha_referencia": today.isoformat(),
            "total_vencidos": len(vencidos),
            "tickets": vencidos[:safe_limit],
        }

    return _fmt(result)


@tool
async def consultar_sla(modulo: Modulo = "MEJORA_CONTINUA", estado: Optional[str] = None, limite: int = 50) -> str:
    """Consulta monitoreo SLA: cumplimiento, vencidos, en riesgo, pausados, incumplidos y detalle por ticket."""
    mod = _normalize_modulo(modulo)
    modules = ["MEJORA_CONTINUA", "FABRICA"] if mod == "TODOS" else [mod]
    pool = get_pool()
    estado_q = (estado or "").strip().upper().replace(" ", "_")
    safe_limit = max(1, min(limite or 50, 100))
    result = {}
    for module in modules:
        report = await Q.get_sla_report(pool, module)
        tickets = report.get("tickets", [])
        if estado_q:
            tickets = [t for t in tickets if estado_q in (t.get("estado_sla") or "")]
        report["tickets"] = tickets[:safe_limit]
        result[module] = report
    return _fmt(result)


@tool
async def consultar_resumen_operativo(modulo: Modulo = "TODOS") -> str:
    """Resume la realidad operativa actual: PI activo, conteos por estado, planificados, fechas, entregas, escalamientos y alertas."""
    mod = _normalize_modulo(modulo)
    modules = ["MEJORA_CONTINUA", "FABRICA"] if mod == "TODOS" else [mod]
    pool = get_pool()
    data = {}
    capacidad = await Q.get_capacidad_personas(pool, "MEJORA_CONTINUA")
    sobrecargados = [p for p in capacidad if p.get("estado") == "SOBRECARGADO"]

    for module in modules:
        backlog = await _backlog_for_modulo(pool, module)
        alertas = await Q.get_alertas(pool, module)
        vencidos = [i for i in backlog if _is_vencido(i, date.today())]
        data[module] = {
            "pi_activo": await Q.get_pi_activo(pool, _pi_modulo(module)),
            "total_tickets": len(backlog),
            "por_status": _counts_by(backlog, "status"),
            "por_issue_type": _counts_by(backlog, "issue_type"),
            "planificados_con_horas": sum(1 for i in backlog if float(i.get("total_horas") or 0) > 0),
            "con_fecha_asignacion": sum(1 for i in backlog if i.get("fecha_asignacion")),
            "con_fecha_finalizacion": sum(1 for i in backlog if i.get("fecha_finalizacion")),
            "vencidos_sin_entrega": len(vencidos),
            "con_fecha_entrega": sum(1 for i in backlog if i.get("fecha_entrega")),
            "finalizados_por_status": sum(1 for i in backlog if _is_finalizado_status(i.get("status"))),
            "con_fecha_escalado": sum(1 for i in backlog if i.get("fecha_escalado")),
            "escalados_activos": sum(1 for i in backlog if i.get("fecha_escalado") and not i.get("fecha_reinicio")),
            "con_fecha_reinicio": sum(1 for i in backlog if i.get("fecha_reinicio")),
            "tickets_con_etc": sum(1 for i in backlog if int(i.get("etc") or 0) > 0),
            "etc_total_dias": sum(int(i.get("etc") or 0) for i in backlog),
            "sin_fecha_finalizacion_y_con_horas": sum(
                1 for i in backlog if float(i.get("total_horas") or 0) > 0 and not i.get("fecha_finalizacion")
            ),
            "alertas": {
                "total": len(alertas),
                "rojas": sum(1 for a in alertas if a.get("alerta_desarrollo") == "roja" or a.get("alerta_qa") == "roja"),
                "amarillas": sum(1 for a in alertas if a.get("alerta_desarrollo") == "amarilla" or a.get("alerta_qa") == "amarilla"),
            },
        }

    return _fmt({
        "nota_capacidad": "Mejora Continua y Fábrica comparten capacidad de personas del PI activo.",
        "personas_sobrecargadas": sobrecargados,
        "modulos": data,
    })


# Lista exportable de todas las tools
ALL_TOOLS = [
    consultar_pi_activo,
    consultar_capacidad,
    consultar_resumen_proyectos,
    consultar_backlog,
    consultar_ticket,
    consultar_alertas,
    consultar_vencidos,
    consultar_sla,
    consultar_resumen_operativo,
]
