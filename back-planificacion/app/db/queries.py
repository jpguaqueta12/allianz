from __future__ import annotations

import math
from datetime import date, timedelta
import json
import re
from typing import Any


def _add_working_days(start: date, dias: int, festivos: set[date]) -> date:
    current = start
    added = 0
    while added < dias:
        current = current + timedelta(days=1)
        if current.weekday() < 5 and current not in festivos:
            added += 1
    return current


def _calendar_days_between(start: date | None, end: date | None) -> int:
    if not start or not end or end <= start:
        return 0
    return (end - start).days


def _add_calendar_days(start: date | None, days: int | None) -> date | None:
    if not start:
        return None
    return start + timedelta(days=max(days or 0, 0))


def _calc_alerta(today: date, inicio: date, fin: date) -> str:
    if today >= fin:
        return "roja"
    total = (fin - inicio).days
    if total <= 0:
        return "roja"
    restantes = (fin - today).days
    pct = restantes / total
    return "verde" if pct > 0.30 else "amarilla"


def _calcular_fecha_fin(
    fecha_asignacion: date | None,
    java_total: float,
    cobol_total: float,
    qa_total: float,
    horas_por_dia: int = 8,
    festivos: set[date] | None = None,
) -> date | None:
    if not fecha_asignacion:
        return None
    total = max(java_total, cobol_total) + qa_total
    if total <= 0:
        return None
    dias = math.ceil(total * 1.15 / horas_por_dia)
    return _add_working_days(fecha_asignacion, dias, festivos or set())


def _calcular_fecha_fin_escalada(
    fecha_fin_inicial: date | None,
    escalados: list[dict],
) -> date | None:
    """
    Aplica cada escalado en orden para calcular la fecha de finalización proyectada.
    Si el último escalado no tiene fecha_reinicio, retorna None (aún escalado).
    """
    fin = fecha_fin_inicial
    for esc in escalados:
        fecha_esc = _as_date(esc.get("fecha_escalado"))
        fecha_rei = _as_date(esc.get("fecha_reinicio"))
        if not fecha_esc or not fin:
            continue
        if not fecha_rei:
            return None
        etc = _calendar_days_between(fecha_esc, fin)
        fin = _add_calendar_days(fecha_rei, etc)
    return fin


async def _pi_config_para_ticket(pool: Any, table: str, ticket_id: int) -> tuple[int, set[date]]:
    row = await pool.fetchrow(f"""
        SELECT p.horas_por_dia, p.id AS pi_id
        FROM {table} b
        JOIN pi p ON p.id = b.pi_id
        WHERE b.id = $1
    """, ticket_id)
    if not row:
        return 8, set()
    festivos_rows = await pool.fetch(
        "SELECT fecha FROM festivos WHERE pi_id = $1", row["pi_id"]
    )
    return row["horas_por_dia"], {f["fecha"] for f in festivos_rows}


def _json_safe(value):
    if isinstance(value, date):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_safe(v) for v in value]
    if isinstance(value, dict):
        return {k: _json_safe(v) for k, v in value.items()}
    return value


def _json_load(value):
    if value is None or isinstance(value, (dict, list)):
        return value
    try:
        return json.loads(value)
    except Exception:
        return value


def _as_date(value):
    if isinstance(value, date) or value is None:
        return value
    return date.fromisoformat(value)


# ─── CAPACIDAD ────────────────────────────────────────────────────────────────

TECH_HORA_COLS = {
    "java":       ["horas_analisis_java","horas_desarrollo_java","horas_pruebas_java","horas_af_java"],
    "cobol":      ["horas_analisis_cobol","horas_desarrollo_cobol","horas_pruebas_cobol","horas_af_cobol"],
    "dialogue":   ["horas_analisis_dialogue","horas_desarrollo_dialogue","horas_pruebas_dialogue","horas_af_dialogue"],
    "parametria": ["horas_analisis_parametria","horas_desarrollo_parametria","horas_pruebas_parametria","horas_af_parametria"],
    "qa":         ["horas_analisis_qa","horas_af_qa"],
}
PLAN_PROFILE_ALIASES = {"qa": "calidad", "dialogue": "gestion", "parametria": "gestion"}
VALID_PLAN_PROFILES = {"java", "cobol", "gestion", "calidad"}

QUALITY_TEAM_NAMES = (
    "Carlos Villadiego",
    "Rafael Alvarado",
    "Laura Fernanda Pardo",
    "Maryerin Hernandez",
)


def _split_responsables(value: str | None) -> list[str]:
    if not value:
        return []
    parts = [p.strip() for p in re.split(r"\s*(?:\||;|,)\s*", str(value))]
    seen: set[str] = set()
    result: list[str] = []
    for part in parts:
        if part and part not in seen:
            seen.add(part)
            result.append(part)
    return result


def _planificacion_items_from_extra(extra: object) -> list[dict]:
    data = _json_load(extra) or {}
    if not isinstance(data, dict):
        return []
    items = _json_load(data.get("planificacion_items")) or []
    if not isinstance(items, list):
        return []
    result = []
    for item in items:
        if not isinstance(item, dict):
            continue
        responsable = (item.get("responsable") or "").strip()
        raw_perfil = (item.get("perfil") or "").strip().lower()
        perfil = PLAN_PROFILE_ALIASES.get(raw_perfil, raw_perfil)
        fase = (item.get("fase") or "").strip()
        try:
            horas = float(item.get("horas") or 0)
        except Exception:
            horas = 0
        if responsable and perfil in VALID_PLAN_PROFILES and fase and horas > 0:
            result.append({
                "responsable": responsable,
                "perfil": perfil,
                "fase": fase,
                "horas": horas,
            })
    return result


def _sumar_horas_legacy(row: Any | dict, asignadas: dict[str, float]) -> None:
    data = dict(row)
    for tech, hora_cols in TECH_HORA_COLS.items():
        responsables = _split_responsables(data.get(f"responsable_{tech}"))
        if not responsables:
            continue
        horas = sum(float(data.get(col) or 0) for col in hora_cols)
        if horas <= 0:
            continue
        horas_por_persona = horas / len(responsables)
        for nombre in responsables:
            asignadas[nombre] = asignadas.get(nombre, 0) + horas_por_persona


def _responsables_trabajo(row: Any | dict, items: list[dict] | None = None) -> list[str]:
    data = dict(row)
    names: list[str] = []
    if items:
        for item in items:
            responsable = (item.get("responsable") or "").strip()
            if responsable:
                names.append(responsable)
    else:
        for tech in TECH_HORA_COLS:
            names.extend(_split_responsables(data.get(f"responsable_{tech}")))
    return list(dict.fromkeys(name for name in names if name))


async def _calcular_horas_asignadas_por_persona(pool: Any, pi_id: int) -> dict[str, float]:
    """
    Suma la carga asignada en Mejora Continua y Fabrica en una sola query UNION ALL.
    """
    asignadas: dict[str, float] = {}
    rows = await pool.fetch("""
        SELECT
            extra,
            responsable_java, responsable_cobol, responsable_dialogue,
            responsable_parametria, responsable_qa,
            horas_analisis_java, horas_analisis_cobol, horas_analisis_dialogue,
            horas_analisis_parametria, horas_analisis_qa,
            horas_desarrollo_java, horas_desarrollo_cobol, horas_desarrollo_dialogue,
            horas_desarrollo_parametria,
            horas_pruebas_java, horas_pruebas_cobol, horas_pruebas_dialogue,
            horas_pruebas_parametria,
            horas_af_java, horas_af_cobol, horas_af_dialogue, horas_af_parametria,
            horas_af_qa
        FROM backlog_mejora_continua WHERE pi_id = $1
        UNION ALL
        SELECT
            extra,
            responsable_java, responsable_cobol, responsable_dialogue,
            responsable_parametria, responsable_qa,
            horas_analisis_java, horas_analisis_cobol, horas_analisis_dialogue,
            horas_analisis_parametria, horas_analisis_qa,
            horas_desarrollo_java, horas_desarrollo_cobol, horas_desarrollo_dialogue,
            horas_desarrollo_parametria,
            horas_pruebas_java, horas_pruebas_cobol, horas_pruebas_dialogue,
            horas_pruebas_parametria,
            horas_af_java, horas_af_cobol, horas_af_dialogue, horas_af_parametria,
            horas_af_qa
        FROM backlog_fabrica WHERE pi_id = $1
    """, pi_id)
    for row in rows:
        items = _planificacion_items_from_extra(row["extra"])
        if items:
            for item in items:
                nombre = item["responsable"]
                asignadas[nombre] = asignadas.get(nombre, 0) + item["horas"]
        else:
            _sumar_horas_legacy(row, asignadas)
    return asignadas


async def get_capacidad_personas(pool: Any, modulo: str = 'MEJORA_CONTINUA', pi_id: int | None = None) -> list[dict]:
    if pi_id is None:
        pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo=$1 LIMIT 1", modulo
        )
    if not pi_id:
        return []

    asignadas = await _calcular_horas_asignadas_por_persona(pool, pi_id)
    rows = await pool.fetch("""
        SELECT
            per.id,
            per.nombre,
            per.tecnologia,
            per.rol,
            pr.identi           AS proyecto_principal,
            cpp.capacidad_horas AS capacidad
        FROM personas per
        JOIN capacidad_persona_pi cpp ON cpp.persona_id = per.id
        LEFT JOIN proyectos pr ON pr.id = cpp.proyecto_principal
        WHERE cpp.pi_id = $1 AND per.activo = TRUE
        ORDER BY per.tecnologia, per.nombre
    """, pi_id)

    result = []
    for row in rows:
        item = dict(row)
        carga = round(asignadas.get(item["nombre"], 0), 1)
        capacidad = item["capacidad"]
        if item["rol"] == "Lider Tec.":
            horas_disponibles = capacidad
            estado = "LIDER TECNICO"
        elif capacidad is None:
            horas_disponibles = None
            estado = "SIN CAPACIDAD"
        else:
            horas_disponibles = round(float(capacidad) - carga, 1)
            if carga > float(capacidad):
                estado = "SOBRECARGADO"
            elif carga >= float(capacidad) * 0.5:
                estado = "OCUPADO"
            else:
                estado = "DISPONIBLE"

        item["carga_estimada"] = carga
        item["horas_disponibles"] = horas_disponibles
        item["estado"] = estado
        result.append(item)
    return result


async def ensure_quality_team_capacity(pool: Any, pi_id: int) -> dict:
    """Crea el equipo de Calidad y lo agrega a la capacidad del PI."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            horas_pi = await conn.fetchval(
                "SELECT horas_por_persona FROM pi WHERE id = $1", pi_id
            )
            if horas_pi is None:
                raise ValueError("PI no encontrado")

            created = 0
            attached = 0
            for nombre in QUALITY_TEAM_NAMES:
                persona = await conn.fetchrow(
                    "SELECT id FROM personas WHERE nombre=$1 AND tecnologia='CALIDAD'",
                    nombre,
                )
                if not persona:
                    persona = await conn.fetchrow("""
                        INSERT INTO personas (nombre, tecnologia, rol, activo)
                        VALUES ($1, 'CALIDAD', 'Desarrollador', 1);
                        SELECT id FROM personas WHERE id = CAST(SCOPE_IDENTITY() AS int)
                    """, nombre)
                    created += 1

                exists = await conn.fetchval(
                    "SELECT COUNT(*) FROM capacidad_persona_pi WHERE pi_id=$1 AND persona_id=$2",
                    pi_id,
                    persona["id"],
                )
                if not exists:
                    await conn.execute("""
                        INSERT INTO capacidad_persona_pi (pi_id, persona_id, capacidad_horas)
                        VALUES ($1, $2, $3)
                    """, pi_id, persona["id"], int(horas_pi))
                    attached += 1

    return {"creadas": created, "agregadas": attached, "horas_por_persona": int(horas_pi)}


async def get_resumen_proyectos(pool: Any, modulo: str = 'MEJORA_CONTINUA', pi_id: int | None = None) -> list[dict]:
    # FABRICA comparte PI con MEJORA_CONTINUA; filtramos proyectos por su propio módulo
    pi_modulo = 'MEJORA_CONTINUA' if modulo == 'FABRICA' else modulo
    if pi_id is None:
        pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo=$1 LIMIT 1",
            pi_modulo,
        )
    if not pi_id:
        return []
    rows = await pool.fetch("""
        SELECT
            p.id,
            p.identi,
            p.nombre,
            p.modulo,
            cpp.cap_java_horas,
            cpp.cap_cobol_horas,
            cpp.alerta::text
        FROM proyectos p
        JOIN capacidad_proyecto_pi cpp ON cpp.proyecto_id = p.id
        JOIN pi ON pi.id = cpp.pi_id AND pi.modulo = $1
        WHERE cpp.pi_id = $2 AND p.modulo = $3 AND p.activo = TRUE
        ORDER BY p.nombre
    """, pi_modulo, pi_id, modulo)
    return [dict(r) for r in rows]


# ─── GESTIÓN CAPACIDAD PERSONAS ──────────────────────────────────────────────

async def crear_y_agregar_persona(
    pool: Any,
    pi_id: int,
    nombre: str,
    apellidos: str,
    tecnologia: str,
) -> dict:
    """Crea una persona nueva y la agrega a la capacidad del PI con horas_por_persona del PI."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            horas_pi = await conn.fetchval(
                "SELECT horas_por_persona FROM pi WHERE id = $1", pi_id
            )
            nombre_completo = f"{nombre} {apellidos}".strip()
            persona = await conn.fetchrow("""
                INSERT INTO personas (nombre, tecnologia, rol, activo)
                VALUES ($1, $2, 'Desarrollador', 1);
                SELECT id, nombre, tecnologia, rol
                FROM personas
                WHERE id = CAST(SCOPE_IDENTITY() AS int)
            """, nombre_completo, tecnologia.upper())
            await conn.execute("""
                IF NOT EXISTS (SELECT 1 FROM capacidad_persona_pi WHERE pi_id=$1 AND persona_id=$2)
                INSERT INTO capacidad_persona_pi (pi_id, persona_id, capacidad_horas)
                VALUES ($1, $2, $3)
            """, pi_id, persona["id"], horas_pi)
    return {**dict(persona), "capacidad_horas": horas_pi}


async def remove_persona_de_capacidad(pool: Any, pi_id: int, persona_id: int) -> bool:
    result = await pool.execute(
        "DELETE FROM capacidad_persona_pi WHERE pi_id=$1 AND persona_id=$2",
        pi_id, persona_id,
    )
    return result == "DELETE 1"


async def sincronizar_capacidad_a_pi(pool: Any, pi_id: int) -> dict:
    """Resetea capacidad_horas de todas las personas del PI al valor dias_laborables*horas_por_dia del PI."""
    row = await pool.fetchrow(
        "SELECT dias_laborables, horas_por_dia, COALESCE(horas_por_persona, dias_laborables * horas_por_dia) AS hpp FROM pi WHERE id=$1",
        pi_id,
    )
    if not row:
        raise ValueError("PI no encontrado")
    hpp = row["hpp"]
    if not hpp:
        raise ValueError("El PI no tiene días laborables ni horas/día configurados")
    result = await pool.execute(
        "UPDATE capacidad_persona_pi SET capacidad_horas=$1 WHERE pi_id=$2 AND capacidad_horas IS NOT NULL",
        int(hpp), pi_id,
    )
    updated = int(result.split()[-1])
    return {"actualizado": updated, "horas_por_persona": int(hpp)}


# ─── GESTIÓN CAPACIDAD PROYECTOS ──────────────────────────────────────────────

async def crear_y_agregar_proyecto(
    pool: Any,
    pi_id: int,
    nombre: str,
    identi: str,
    modulo: str,
) -> dict:
    """Crea un proyecto nuevo y lo agrega a la capacidad del PI con 0 horas."""
    async with pool.acquire() as conn:
        async with conn.transaction():
            proyecto = await conn.fetchrow("""
                INSERT INTO proyectos (identi, nombre, modulo, activo)
                VALUES ($1, $2, $3, 1);
                SELECT id, identi, nombre, modulo
                FROM proyectos
                WHERE id = CAST(SCOPE_IDENTITY() AS int)
            """, identi.upper(), nombre, modulo)
            await conn.execute("""
                IF NOT EXISTS (SELECT 1 FROM capacidad_proyecto_pi WHERE pi_id=$1 AND proyecto_id=$2)
                INSERT INTO capacidad_proyecto_pi (pi_id, proyecto_id, cap_java_horas, cap_cobol_horas)
                VALUES ($1, $2, 0, 0)
            """, pi_id, proyecto["id"])
    return dict(proyecto)


async def remove_proyecto_de_capacidad(pool: Any, pi_id: int, proyecto_id: int) -> bool:
    result = await pool.execute(
        "DELETE FROM capacidad_proyecto_pi WHERE pi_id=$1 AND proyecto_id=$2",
        pi_id, proyecto_id,
    )
    return result == "DELETE 1"


# ─── BACKLOG ──────────────────────────────────────────────────────────────────

async def get_responsables_disponibles(pool: Any, modulo: str, pi_id: int | None = None) -> list[dict]:
    """
    Devuelve personas del PI activo con horas asignadas ya acumuladas en ambos
    backlogs (MC + Fábrica comparten PI). Marca al_tope=True si asignadas >= capacidad.
    """
    pi_modulo = 'MEJORA_CONTINUA' if modulo in ('MEJORA_CONTINUA', 'FABRICA') else modulo
    if pi_id is None:
        pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo=$1 LIMIT 1", pi_modulo
        )
    if not pi_id:
        return []

    personas = await pool.fetch("""
        SELECT p.id, p.nombre, p.tecnologia, p.rol, cpp.capacidad_horas
        FROM personas p
        JOIN capacidad_persona_pi cpp ON cpp.persona_id = p.id
        WHERE cpp.pi_id = $1 AND p.activo = TRUE
        ORDER BY p.tecnologia, p.nombre
    """, pi_id)

    asignadas = await _calcular_horas_asignadas_por_persona(pool, pi_id)

    result = []
    for p in personas:
        cap  = float(p["capacidad_horas"] or 0)
        asig = asignadas.get(p["nombre"], 0)
        result.append({
            "id":              p["id"],
            "nombre":          p["nombre"],
            "tecnologia":      p["tecnologia"],
            "rol":             p["rol"],
            "capacidad_horas": cap,
            "horas_asignadas": round(asig, 1),
            "horas_restantes": round(max(cap - asig, 0), 1),
            "al_tope":         cap > 0 and asig >= cap,
        })
    return result


async def get_backlog_incidentes(pool: Any, pi_id: int) -> list[dict]:
    rows = await pool.fetch("""
        SELECT
            id, numero, equipo,
            to_char(fecha_escalado, 'YYYY-MM-DD HH24:MI') AS fecha_escalado,
            estado_sn, jira, comentario,
            to_char(fecha_respuesta, 'YYYY-MM-DD HH24:MI') AS fecha_respuesta,
            dias
        FROM backlog_incidentes
        WHERE pi_id = $1
        ORDER BY fecha_escalado DESC NULLS LAST
    """, pi_id)
    return [dict(r) for r in rows]


async def get_backlog(pool: Any, modulo: str, pi_id: int) -> list[dict]:
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"
    rows = await pool.fetch(f"""
        SELECT
            id,
            to_char(created, 'YYYY-MM-DD HH24:MI') AS created,
            issue_type, ticket_key, project, status, include_release_notes,
            resolution, summary, assigned_team, assignee, reporter, epic_link,
            priority,
            story_points::float AS story_points,
            sprint, labels, components, fix_version,
            to_char(updated, 'YYYY-MM-DD') AS updated,
            -- responsables por tecnología
            responsable_java, responsable_cobol, responsable_dialogue,
            responsable_parametria, responsable_qa,
            -- planificación
            horas_analisis_java::float,    horas_analisis_cobol::float,
            horas_analisis_dialogue::float, horas_analisis_parametria::float,
            horas_analisis_qa::float,
            horas_desarrollo_java::float,   horas_desarrollo_cobol::float,
            horas_desarrollo_dialogue::float, horas_desarrollo_parametria::float,
            horas_pruebas_java::float,      horas_pruebas_cobol::float,
            horas_pruebas_dialogue::float,  horas_pruebas_parametria::float,
            horas_af_java::float,           horas_af_cobol::float,
            horas_af_dialogue::float,       horas_af_parametria::float,
            horas_af_qa::float,
            COALESCE(JSON_QUERY(extra, '$.planificacion_items'), '[]') AS planificacion_items,
            to_char(fecha_asignacion,           'YYYY-MM-DD') AS fecha_asignacion,
            to_char(fecha_finalizacion,         'YYYY-MM-DD') AS fecha_finalizacion,
            to_char(fecha_finalizacion_inicial, 'YYYY-MM-DD') AS fecha_finalizacion_inicial,
            to_char(fecha_escalado,             'YYYY-MM-DD') AS fecha_escalado,
            to_char(fecha_reinicio,             'YYYY-MM-DD') AS fecha_reinicio,
            to_char(fecha_entrega,              'YYYY-MM-DD') AS fecha_entrega,
            COALESCE(etc, 0)::int AS etc,
            COALESCE(escalados, '[]') AS escalados,
            -- total calculado
            COALESCE(horas_analisis_java,0) + COALESCE(horas_analisis_cobol,0)
            + COALESCE(horas_analisis_dialogue,0) + COALESCE(horas_analisis_parametria,0)
            + COALESCE(horas_analisis_qa,0)
            + COALESCE(horas_desarrollo_java,0) + COALESCE(horas_desarrollo_cobol,0)
            + COALESCE(horas_desarrollo_dialogue,0) + COALESCE(horas_desarrollo_parametria,0)
            + COALESCE(horas_pruebas_java,0) + COALESCE(horas_pruebas_cobol,0)
            + COALESCE(horas_pruebas_dialogue,0) + COALESCE(horas_pruebas_parametria,0)
            + COALESCE(horas_af_java,0) + COALESCE(horas_af_cobol,0)
            + COALESCE(horas_af_dialogue,0) + COALESCE(horas_af_parametria,0)
            + COALESCE(horas_af_qa,0) AS total_horas
        FROM {table}
        WHERE pi_id = $1
        ORDER BY ticket_key NULLS LAST, summary
    """, pi_id)
    horas_dia = await pool.fetchval("SELECT horas_por_dia FROM pi WHERE id = $1", pi_id) or 8
    festivos_rows = await pool.fetch("SELECT fecha FROM festivos WHERE pi_id = $1", pi_id)
    festivos = {f["fecha"] for f in festivos_rows}
    result = []
    for row in rows:
        item = dict(row)
        item["planificacion_items"] = _json_load(item.get("planificacion_items")) or []
        if item["planificacion_items"]:
            item["total_horas"] = round(
                sum(float(plan.get("horas") or 0) for plan in item["planificacion_items"]),
                1,
            )
        item["escalados"] = _json_load(item.get("escalados")) or []

        # Backward compat: tickets que aún no tienen la columna escalados poblada
        # pero sí tienen fecha_escalado en la BD, se reconstruye el array desde los campos legacy.
        if not item["escalados"] and item.get("fecha_escalado"):
            item["escalados"] = [{
                "fecha_escalado": item["fecha_escalado"],
                "fecha_reinicio": item.get("fecha_reinicio"),
            }]

        # Compute fecha_finalizacion_inicial (base without escalations)
        fecha_fin_inicial = _as_date(item.get("fecha_finalizacion_inicial"))
        if not fecha_fin_inicial:
            java, cobol, qa = _horas_por_perfil_de_data(item)
            fecha_fin_inicial = _calcular_fecha_fin(
                _as_date(item.get("fecha_asignacion")),
                java, cobol, qa, horas_dia, festivos,
            )
            item["fecha_finalizacion_inicial"] = fecha_fin_inicial.isoformat() if fecha_fin_inicial else None

        # Apply escalations to compute projected end date
        if item["escalados"]:
            escalados_list = item["escalados"]
            fecha_fin_computed = _calcular_fecha_fin_escalada(fecha_fin_inicial, escalados_list)
            item["fecha_finalizacion"] = fecha_fin_computed.isoformat() if fecha_fin_computed else None
            last_esc = escalados_list[-1]
            if not last_esc.get("fecha_reinicio"):
                fin_before_last = _calcular_fecha_fin_escalada(fecha_fin_inicial, escalados_list[:-1])
                stored_etc = item.get("etc") or 0
                computed_etc = _calendar_days_between(_as_date(last_esc["fecha_escalado"]), fin_before_last)
                item["etc"] = stored_etc if stored_etc else computed_etc
            else:
                item["etc"] = 0
            item["fecha_escalado"] = last_esc.get("fecha_escalado")
            item["fecha_reinicio"] = last_esc.get("fecha_reinicio")
        else:
            item["etc"] = 0
            # Preserve DB values (no escalation set, no override needed)
            item["fecha_escalado"] = None
            item["fecha_reinicio"] = None
        result.append(item)
    return result


async def create_backlog_item(pool: Any, modulo: str, pi_id: int, data: dict) -> dict:
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"
    summary = (data.get("summary") or "").strip()
    if not summary:
        raise ValueError("El summary es obligatorio")

    ticket_key = (data.get("ticket_key") or "").strip() or None
    if ticket_key:
        exists = await pool.fetchval(
            f"SELECT COUNT(*) FROM {table} WHERE UPPER(REPLACE(ticket_key, ' ', ''))=$1 AND pi_id=$2",
            ticket_key.upper().replace(" ", ""),
            pi_id,
        )
        if exists:
            raise ValueError("Ya existe un ticket con ese Key en este PI")

    row = await pool.fetchrow(f"""
        INSERT INTO {table}
            (created, issue_type, ticket_key, project, status, summary,
             assigned_team, assignee, reporter, epic_link, priority,
             story_points, sprint, labels, components, fix_version, pi_id, extra)
        VALUES
            (GETDATE(), $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
             $11, $12, $13, $14, $15, $16, $17);
        SELECT CAST(SCOPE_IDENTITY() AS int) AS id
    """,
        data.get("issue_type"),
        ticket_key,
        data.get("project"),
        data.get("status") or "Backlog",
        summary,
        data.get("assigned_team"),
        data.get("assignee"),
        data.get("reporter"),
        data.get("epic_link"),
        data.get("priority"),
        data.get("story_points"),
        data.get("sprint"),
        data.get("labels"),
        data.get("components"),
        data.get("fix_version"),
        pi_id,
        json.dumps({"manual": True}, ensure_ascii=False),
    )
    created_id = row["id"] if row else None
    for item in await get_backlog(pool, modulo, pi_id):
        if item["id"] == created_id:
            return item
    raise ValueError("No se pudo cargar el ticket creado")


async def delete_backlog_item(pool: Any, modulo: str, ticket_id: int) -> bool:
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"
    result = await pool.execute(f"DELETE FROM {table} WHERE id=$1", ticket_id)
    return result == "DELETE 1"


def _horas_por_perfil_de_data(data: dict) -> tuple[float, float, float]:
    java  = sum(data.get(f) or 0 for f in [
        'horas_analisis_java', 'horas_desarrollo_java', 'horas_pruebas_java', 'horas_af_java'])
    cobol = sum(data.get(f) or 0 for f in [
        'horas_analisis_cobol', 'horas_desarrollo_cobol', 'horas_pruebas_cobol', 'horas_af_cobol'])
    qa    = sum(data.get(f) or 0 for f in ['horas_analisis_qa', 'horas_af_qa'])
    # si existen planificacion_items, úsalos (son más precisos)
    items = _json_load(data.get("planificacion_items")) or []
    if not items and data.get("extra") is not None:
        items = _planificacion_items_from_extra(data.get("extra"))
    if items:
        java = cobol = qa = 0
        for it in items:
            h = it.get("horas") or 0
            p = it.get("perfil", "")
            if p == "java":   java  += h
            elif p == "cobol": cobol += h
            elif p in ("calidad", "qa"): qa += h
    return java, cobol, qa


async def update_planificacion(pool: Any, modulo: str, ticket_id: int, data: dict) -> None:
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"
    planificacion_items = data.get("planificacion_items") or []
    planificacion_items_json = json.dumps(
        [_json_safe(item) for item in planificacion_items],
        ensure_ascii=False,
    )
    await pool.execute(f"""
        UPDATE {table} SET
            responsable_java          = $1,  responsable_cobol         = $2,
            responsable_dialogue      = $3,  responsable_parametria    = $4,
            responsable_qa            = $5,
            horas_analisis_java       = $6,  horas_analisis_cobol      = $7,
            horas_analisis_dialogue   = $8,  horas_analisis_parametria = $9,
            horas_analisis_qa         = $10,
            horas_desarrollo_java     = $11, horas_desarrollo_cobol    = $12,
            horas_desarrollo_dialogue = $13, horas_desarrollo_parametria = $14,
            horas_pruebas_java        = $15, horas_pruebas_cobol       = $16,
            horas_pruebas_dialogue    = $17, horas_pruebas_parametria  = $18,
            horas_af_java             = $19, horas_af_cobol            = $20,
            horas_af_dialogue         = $21, horas_af_parametria       = $22,
            horas_af_qa               = $23,
            fecha_asignacion          = $24
        WHERE id = $25
    """,
        data.get("responsable_java"),       data.get("responsable_cobol"),
        data.get("responsable_dialogue"),   data.get("responsable_parametria"),
        data.get("responsable_qa"),
        data.get("horas_analisis_java"),    data.get("horas_analisis_cobol"),
        data.get("horas_analisis_dialogue"), data.get("horas_analisis_parametria"),
        data.get("horas_analisis_qa"),
        data.get("horas_desarrollo_java"),   data.get("horas_desarrollo_cobol"),
        data.get("horas_desarrollo_dialogue"), data.get("horas_desarrollo_parametria"),
        data.get("horas_pruebas_java"),      data.get("horas_pruebas_cobol"),
        data.get("horas_pruebas_dialogue"),  data.get("horas_pruebas_parametria"),
        data.get("horas_af_java"),           data.get("horas_af_cobol"),
        data.get("horas_af_dialogue"),       data.get("horas_af_parametria"),
        data.get("horas_af_qa"),
        date.fromisoformat(data["fecha_asignacion"]) if data.get("fecha_asignacion") else None,
        ticket_id,
    )
    existing_extra = await pool.fetchval(f"SELECT extra FROM {table} WHERE id = $1", ticket_id)
    extra_data = _json_load(existing_extra) or {}
    if not isinstance(extra_data, dict):
        extra_data = {}
    extra_data["planificacion_items"] = _json_load(planificacion_items_json) or []
    await pool.execute(
        f"UPDATE {table} SET extra = $1 WHERE id = $2",
        json.dumps(_json_safe(extra_data), ensure_ascii=False),
        ticket_id,
    )
    # recalcular fecha_finalizacion con configuración del PI y escalados
    fechas = await pool.fetchrow(
        f"SELECT fecha_asignacion, escalados, fecha_escalado, fecha_reinicio FROM {table} WHERE id = $1",
        ticket_id,
    )
    horas_dia, festivos = await _pi_config_para_ticket(pool, table, ticket_id)
    java, cobol, qa = _horas_por_perfil_de_data(data)
    fecha_fin_base = _calcular_fecha_fin(fechas["fecha_asignacion"] if fechas else None, java, cobol, qa, horas_dia, festivos)
    await pool.execute(f"UPDATE {table} SET fecha_finalizacion_inicial = $1 WHERE id = $2", fecha_fin_base, ticket_id)
    escalados_list = _json_load(fechas.get("escalados") if fechas else None) or []
    if not escalados_list and fechas and fechas.get("fecha_escalado"):
        escalados_list = [{"fecha_escalado": str(fechas["fecha_escalado"]), "fecha_reinicio": str(fechas["fecha_reinicio"]) if fechas.get("fecha_reinicio") else None}]
    fecha_fin = _calcular_fecha_fin_escalada(fecha_fin_base, escalados_list)
    if escalados_list and not escalados_list[-1].get("fecha_reinicio"):
        fin_before_last = _calcular_fecha_fin_escalada(fecha_fin_base, escalados_list[:-1])
        etc = _calendar_days_between(_as_date(escalados_list[-1]["fecha_escalado"]), fin_before_last)
        await pool.execute(f"UPDATE {table} SET etc = $1 WHERE id = $2", etc, ticket_id)
    await pool.execute(f"UPDATE {table} SET fecha_finalizacion = $1 WHERE id = $2", fecha_fin, ticket_id)


async def update_fecha_asignacion(pool: Any, modulo: str, ticket_id: int, fecha: str | None) -> date | None:
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"
    fecha_date = date.fromisoformat(fecha) if fecha else None
    await pool.execute(
        f"UPDATE {table} SET fecha_asignacion = $1 WHERE id = $2",
        fecha_date, ticket_id,
    )
    # recalcular fecha_finalizacion con las horas ya guardadas en la fila
    row = await pool.fetchrow(f"""
        SELECT horas_analisis_java, horas_desarrollo_java, horas_pruebas_java, horas_af_java,
               horas_analisis_cobol, horas_desarrollo_cobol, horas_pruebas_cobol, horas_af_cobol,
               horas_analisis_qa, horas_af_qa, extra, escalados, fecha_escalado, fecha_reinicio
        FROM {table} WHERE id = $1
    """, ticket_id)
    if row:
        row_dict = dict(row)
        horas_dia, festivos = await _pi_config_para_ticket(pool, table, ticket_id)
        java, cobol, qa = _horas_por_perfil_de_data(row_dict)
        fecha_fin_base = _calcular_fecha_fin(fecha_date, java, cobol, qa, horas_dia, festivos)
        await pool.execute(f"UPDATE {table} SET fecha_finalizacion_inicial = $1 WHERE id = $2", fecha_fin_base, ticket_id)
        escalados_list = _json_load(row_dict.get("escalados")) or []
        if not escalados_list and row_dict.get("fecha_escalado"):
            escalados_list = [{"fecha_escalado": str(row_dict["fecha_escalado"]), "fecha_reinicio": str(row_dict["fecha_reinicio"]) if row_dict.get("fecha_reinicio") else None}]
        fecha_fin = _calcular_fecha_fin_escalada(fecha_fin_base, escalados_list)
        if escalados_list and not escalados_list[-1].get("fecha_reinicio"):
            fin_before_last = _calcular_fecha_fin_escalada(fecha_fin_base, escalados_list[:-1])
            etc = _calendar_days_between(_as_date(escalados_list[-1]["fecha_escalado"]), fin_before_last)
            await pool.execute(f"UPDATE {table} SET etc = $1 WHERE id = $2", etc, ticket_id)
        await pool.execute(
            f"UPDATE {table} SET fecha_finalizacion = $1 WHERE id = $2",
            fecha_fin, ticket_id,
        )
        return fecha_fin, fecha_fin_base
    return None, None


async def update_escalamiento(
    pool: Any,
    modulo: str,
    ticket_id: int,
    escalados: list[dict],
) -> dict:
    """
    Actualiza los escalados de un ticket. Acepta una lista de pares
    {fecha_escalado, fecha_reinicio}. Solo el último par puede tener fecha_reinicio=None.
    """
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"

    # Validate and parse each escalation entry
    validated: list[dict] = []
    for i, esc in enumerate(escalados):
        fe_str = esc.get("fecha_escalado")
        fr_str = esc.get("fecha_reinicio")
        if not fe_str:
            raise ValueError(f"Escalamiento {i + 1}: fecha_escalado es requerida")
        fe_date = date.fromisoformat(fe_str)
        fr_date = date.fromisoformat(fr_str) if fr_str else None
        if fr_date and fr_date < fe_date:
            raise ValueError(f"Escalamiento {i + 1}: fecha_reinicio no puede ser anterior a fecha_escalado")
        if i < len(escalados) - 1 and not fr_date:
            raise ValueError(f"Escalamiento {i + 1}: solo el último escalamiento puede no tener fecha_reinicio")
        validated.append({"fecha_escalado": fe_date, "fecha_reinicio": fr_date})

    row = await pool.fetchrow(f"""
        SELECT status, status_antes_escalado, fecha_asignacion, fecha_finalizacion_inicial,
               horas_analisis_java, horas_desarrollo_java, horas_pruebas_java, horas_af_java,
               horas_analisis_cobol, horas_desarrollo_cobol, horas_pruebas_cobol, horas_af_cobol,
               horas_analisis_qa, horas_af_qa, extra
        FROM {table}
        WHERE id = $1
    """, ticket_id)
    if not row:
        raise ValueError("Ticket no encontrado")

    horas_dia, festivos = await _pi_config_para_ticket(pool, table, ticket_id)
    row_dict = dict(row)

    # Get or compute fecha_finalizacion_inicial (base without escalations)
    fecha_fin_inicial = _as_date(row.get("fecha_finalizacion_inicial"))
    if not fecha_fin_inicial:
        java, cobol, qa = _horas_por_perfil_de_data(row_dict)
        fecha_fin_inicial = _calcular_fecha_fin(
            _as_date(row["fecha_asignacion"]) if row.get("fecha_asignacion") else None,
            java, cobol, qa, horas_dia, festivos,
        )
        if fecha_fin_inicial:
            await pool.execute(
                f"UPDATE {table} SET fecha_finalizacion_inicial = $1 WHERE id = $2",
                fecha_fin_inicial, ticket_id,
            )

    # Compute projected end date considering all escalations
    fecha_fin = _calcular_fecha_fin_escalada(fecha_fin_inicial, validated)

    # Status management
    status_actual = row["status"]
    status_previo = row.get("status_antes_escalado")
    status_base = status_previo or (None if (status_actual or "").lower() == "escalado" else status_actual)

    if not validated:
        status = status_previo if (status_actual or "").lower() == "escalado" else status_actual
        etc = 0
        status_antes_escalado = None
        fecha_escalado_last = None
        fecha_reinicio_last = None
    elif not validated[-1]["fecha_reinicio"]:
        fin_before_last = _calcular_fecha_fin_escalada(fecha_fin_inicial, validated[:-1])
        etc = _calendar_days_between(validated[-1]["fecha_escalado"], fin_before_last)
        status = "Escalado"
        status_antes_escalado = status_base
        fecha_escalado_last = validated[-1]["fecha_escalado"]
        fecha_reinicio_last = None
    else:
        etc = 0
        status = status_base or status_actual
        status_antes_escalado = None
        fecha_escalado_last = validated[-1]["fecha_escalado"]
        fecha_reinicio_last = validated[-1]["fecha_reinicio"]

    escalados_json = json.dumps([{
        "fecha_escalado": e["fecha_escalado"].isoformat(),
        "fecha_reinicio": e["fecha_reinicio"].isoformat() if e["fecha_reinicio"] else None,
    } for e in validated], ensure_ascii=False)

    await pool.execute(f"""
        UPDATE {table}
        SET escalados              = $1,
            fecha_escalado         = $2,
            fecha_reinicio         = $3,
            etc                    = $4,
            fecha_finalizacion     = $5,
            status                 = $6,
            status_antes_escalado  = $7
        WHERE id = $8
    """, escalados_json, fecha_escalado_last, fecha_reinicio_last, etc, fecha_fin, status, status_antes_escalado, ticket_id)

    return {
        "escalados": json.loads(escalados_json),
        "fecha_escalado": fecha_escalado_last,
        "fecha_reinicio": fecha_reinicio_last,
        "fecha_finalizacion": fecha_fin,
        "fecha_finalizacion_inicial": fecha_fin_inicial,
        "etc": etc,
        "status": status,
    }


def _is_finalizado_status(status: str | None) -> bool:
    normalized = (status or "").strip().lower()
    return normalized in {
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


async def update_status(pool: Any, modulo: str, ticket_id: int, status: str) -> dict:
    table = "backlog_mejora_continua" if modulo == "MEJORA_CONTINUA" else "backlog_fabrica"
    normalized_status = (status or "").strip()
    if not normalized_status:
        raise ValueError("Status es requerido")

    row = await pool.fetchrow(
        f"SELECT id, fecha_entrega FROM {table} WHERE id = $1",
        ticket_id,
    )
    if not row:
        raise ValueError("Ticket no encontrado")

    fecha_entrega = row["fecha_entrega"]
    if _is_finalizado_status(normalized_status):
        if not fecha_entrega:
            fecha_entrega = date.today()
    else:
        fecha_entrega = None

    await pool.execute(
        f"UPDATE {table} SET status = $1, fecha_entrega = $2 WHERE id = $3",
        normalized_status,
        fecha_entrega,
        ticket_id,
    )
    return {"status": normalized_status, "fecha_entrega": fecha_entrega}


async def get_sla_report(pool: Any, modulo: str, pi_id: int | None = None) -> dict:
    mod = "FABRICA" if modulo == "FABRICA" else "MEJORA_CONTINUA"
    if pi_id is None:
        pi_id = await pool.fetchval(
            "SELECT id FROM pi WHERE activo=TRUE AND modulo='MEJORA_CONTINUA' LIMIT 1"
        )
    if not pi_id:
        return {"modulo": mod, "pi_id": None, "policies": [], "tickets": [], "summary": {}}

    policies_rows = await pool.fetch("""
        SELECT id, modulo, issue_type, priority, nombre, sla_dias, alerta_pct::float AS alerta_pct, pausa_escalado, activo
        FROM sla_policies
        WHERE modulo = $1 AND activo = TRUE
        ORDER BY
            CASE
                WHEN issue_type IS NOT NULL AND priority IS NOT NULL THEN 1
                WHEN priority IS NOT NULL THEN 2
                WHEN issue_type IS NOT NULL THEN 3
                ELSE 4
            END,
            sla_dias
    """, mod)
    policies = [dict(row) for row in policies_rows]
    if not policies:
        policies = [{
            "id": None,
            "modulo": mod,
            "issue_type": None,
            "priority": None,
            "nombre": f"SLA estándar {mod}",
            "sla_dias": 10,
            "alerta_pct": 0.30,
            "pausa_escalado": True,
            "activo": True,
        }]

    def select_policy(item: dict) -> dict:
        issue_type = item.get("issue_type")
        priority = item.get("priority")
        for policy in policies:
            if policy.get("issue_type") == issue_type and policy.get("priority") == priority:
                return policy
        for policy in policies:
            if policy.get("priority") == priority and policy.get("issue_type") is None:
                return policy
        for policy in policies:
            if policy.get("issue_type") == issue_type and policy.get("priority") is None:
                return policy
        for policy in policies:
            if policy.get("issue_type") is None and policy.get("priority") is None:
                return policy
        return policies[0]

    today = date.today()
    backlog = await get_backlog(pool, mod, pi_id)
    tickets = []

    for item in backlog:
        policy = select_policy(item)
        start = _as_date(item.get("fecha_asignacion")) or _as_date((item.get("created") or "")[:10])
        entrega = _as_date(item.get("fecha_entrega"))
        escalado = _as_date(item.get("fecha_escalado"))
        reinicio = _as_date(item.get("fecha_reinicio"))
        close_date = entrega if entrega else None
        status = item.get("status")
        finalizado = bool(entrega) or _is_finalizado_status(status)
        active_date = close_date or today
        pausa_dias = 0
        if policy.get("pausa_escalado") and escalado:
            pause_end = reinicio or active_date
            pausa_dias = _calendar_days_between(escalado, pause_end)

        sla_dias = int(policy.get("sla_dias") or 10)
        deadline = _add_calendar_days(start, sla_dias + pausa_dias) if start else None
        elapsed_raw = _calendar_days_between(start, active_date) if start else 0
        consumido = max(0, elapsed_raw - pausa_dias)
        restante = (deadline - active_date).days if deadline and not finalizado else None
        progreso = min(100, round((consumido / max(sla_dias, 1)) * 100)) if start else 0

        if not start:
            estado_sla = "SIN_INICIO"
        elif escalado and not reinicio and not finalizado:
            estado_sla = "PAUSADO"
        elif finalizado:
            estado_sla = "CUMPLIDO" if close_date and deadline and close_date <= deadline else "INCUMPLIDO"
        elif deadline and today > deadline:
            estado_sla = "VENCIDO"
        elif deadline and restante is not None and restante / max(sla_dias, 1) <= float(policy.get("alerta_pct") or 0.30):
            estado_sla = "EN_RIESGO"
        else:
            estado_sla = "EN_TIEMPO"

        tickets.append({
            "id": item.get("id"),
            "ticket_key": item.get("ticket_key"),
            "summary": item.get("summary"),
            "status": status,
            "issue_type": item.get("issue_type"),
            "priority": item.get("priority"),
            "assignee": item.get("assignee"),
            "fecha_inicio_sla": start.isoformat() if start else None,
            "fecha_limite_sla": deadline.isoformat() if deadline else None,
            "fecha_entrega": entrega.isoformat() if entrega else None,
            "fecha_escalado": item.get("fecha_escalado"),
            "fecha_reinicio": item.get("fecha_reinicio"),
            "sla_dias": sla_dias,
            "pausa_dias": pausa_dias,
            "consumido_dias": consumido,
            "restante_dias": restante,
            "progreso_pct": progreso,
            "estado_sla": estado_sla,
            "policy": {
                "id": policy.get("id"),
                "nombre": policy.get("nombre"),
                "issue_type": policy.get("issue_type"),
                "priority": policy.get("priority"),
                "alerta_pct": policy.get("alerta_pct"),
                "pausa_escalado": policy.get("pausa_escalado"),
            },
        })

    counts: dict[str, int] = {}
    for ticket in tickets:
        key = ticket["estado_sla"]
        counts[key] = counts.get(key, 0) + 1

    abiertos = [t for t in tickets if t["estado_sla"] not in {"CUMPLIDO", "INCUMPLIDO"}]
    summary = {
        "total": len(tickets),
        "por_estado": dict(sorted(counts.items())),
        "cumplidos": counts.get("CUMPLIDO", 0),
        "incumplidos": counts.get("INCUMPLIDO", 0),
        "vencidos": counts.get("VENCIDO", 0),
        "en_riesgo": counts.get("EN_RIESGO", 0),
        "pausados": counts.get("PAUSADO", 0),
        "sin_inicio": counts.get("SIN_INICIO", 0),
        "abiertos": len(abiertos),
        "cumplimiento_pct": round((counts.get("CUMPLIDO", 0) / max(counts.get("CUMPLIDO", 0) + counts.get("INCUMPLIDO", 0), 1)) * 100),
    }
    await pool.execute("""
        IF EXISTS (
            SELECT 1 FROM sla_daily_snapshots
            WHERE modulo=$1 AND pi_id=$2 AND snapshot_date=$3
        )
            UPDATE sla_daily_snapshots
            SET summary=$4, updated_at=SYSUTCDATETIME()
            WHERE modulo=$1 AND pi_id=$2 AND snapshot_date=$3
        ELSE
            INSERT INTO sla_daily_snapshots (modulo, pi_id, snapshot_date, summary)
            VALUES ($1, $2, $3, $4)
    """, mod, pi_id, today, json.dumps(_json_safe(summary), ensure_ascii=False))
    return {
        "modulo": mod,
        "pi_id": pi_id,
        "fecha_referencia": today.isoformat(),
        "policies": policies,
        "summary": summary,
        "tickets": tickets,
    }


# ─── AUDITORÍA ────────────────────────────────────────────────────────────────

async def registrar_auditoria(
    pool: Any,
    action: str,
    entity_type: str,
    entity_key: str | None = None,
    old_data: dict | None = None,
    new_data: dict | None = None,
    reason: str | None = None,
    actor: str = "agent",
    session_id: str | None = None,
) -> None:
    old_json = json.dumps(_json_safe(old_data), ensure_ascii=False) if old_data is not None else None
    new_json = json.dumps(_json_safe(new_data), ensure_ascii=False) if new_data is not None else None
    await pool.execute("""
        INSERT INTO agent_audit_log (
            session_id, actor, action, entity_type, entity_key, old_data, new_data, reason
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
    """, session_id, actor, action, entity_type, entity_key, old_json, new_json, reason)


# ─── CONFIGURACIÓN PI ─────────────────────────────────────────────────────────

async def get_pis(pool: Any) -> list[dict]:
    rows = await pool.fetch("""
        SELECT
            p.id, p.nombre,
            CONVERT(varchar(10), p.fecha_inicio, 23) AS fecha_inicio,
            CONVERT(varchar(10), p.fecha_fin, 23) AS fecha_fin,
            p.dias_laborables, p.horas_por_dia, p.horas_por_persona,
            p.activo, p.estado, p.descripcion, p.modulo,
            COALESCE(f.festivos_count, 0) AS festivos_count
        FROM pi p
        LEFT JOIN (
            SELECT pi_id, COUNT(*) AS festivos_count
            FROM festivos
            GROUP BY pi_id
        ) f ON f.pi_id = p.id
        ORDER BY p.fecha_inicio DESC
    """)
    return [dict(r) for r in rows]


async def _pi_to_dict_with_festivos(pool: Any, row: dict | None) -> dict | None:
    if not row:
        return None
    d = dict(row)
    festivos = await pool.fetch(
        "SELECT id, CONVERT(varchar(10), fecha, 23) AS fecha, nombre FROM festivos WHERE pi_id=$1 ORDER BY fecha",
        d["id"],
    )
    d["festivos"] = [dict(f) for f in festivos]
    return d


async def get_pi_activo(pool: Any, modulo: str = 'MEJORA_CONTINUA') -> dict | None:
    row = await pool.fetchrow("""
        SELECT
            p.id, p.nombre,
            CONVERT(varchar(10), p.fecha_inicio, 23) AS fecha_inicio,
            CONVERT(varchar(10), p.fecha_fin, 23) AS fecha_fin,
            p.dias_laborables, p.horas_por_dia, p.horas_por_persona,
            p.activo, p.estado, p.descripcion, p.modulo
        FROM pi p
        WHERE p.activo = 1 AND p.modulo = $1
        ORDER BY p.fecha_inicio DESC, p.id DESC
        LIMIT 1
    """, modulo)
    return await _pi_to_dict_with_festivos(pool, row)


async def get_pi_by_id(pool: Any, pi_id: int) -> dict | None:
    row = await pool.fetchrow("""
        SELECT
            p.id, p.nombre,
            CONVERT(varchar(10), p.fecha_inicio, 23) AS fecha_inicio,
            CONVERT(varchar(10), p.fecha_fin, 23) AS fecha_fin,
            p.dias_laborables, p.horas_por_dia, p.horas_por_persona,
            p.activo, p.estado, p.descripcion, p.modulo
        FROM pi p
        WHERE p.id = $1
        LIMIT 1
    """, pi_id)
    return await _pi_to_dict_with_festivos(pool, row)


async def create_pi(
    pool: Any,
    nombre: str,
    fecha_inicio: str,
    fecha_fin: str,
    dias_laborables: int,
    horas_por_dia: int = 8,
    descripcion: str | None = None,
    modulo: str = 'MEJORA_CONTINUA',
) -> dict:
    row = await pool.fetchrow("""
        INSERT INTO pi (nombre, fecha_inicio, fecha_fin, dias_laborables, horas_por_dia, activo, estado, descripcion, modulo)
        VALUES ($1, $2, $3, $4, $5, 0, 'PLANIFICACION', $6, $7);
        SELECT id, nombre,
            CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio,
            CONVERT(varchar(10), fecha_fin, 23) AS fecha_fin,
            dias_laborables, horas_por_dia, horas_por_persona, activo, estado, descripcion, modulo
        FROM pi WHERE id = CAST(SCOPE_IDENTITY() AS int)
    """, nombre, _as_date(fecha_inicio), _as_date(fecha_fin), dias_laborables, horas_por_dia, descripcion, modulo)
    return dict(row)


async def update_pi(pool: Any, pi_id: int, fields: dict) -> dict | None:
    allowed = {"nombre", "fecha_inicio", "fecha_fin", "dias_laborables", "horas_por_dia", "descripcion", "estado"}
    updates = {k: v for k, v in fields.items() if k in allowed}
    for date_field in ("fecha_inicio", "fecha_fin"):
        if date_field in updates:
            updates[date_field] = _as_date(updates[date_field])

    capacity_changes = "dias_laborables" in updates or "horas_por_dia" in updates

    async with pool.acquire() as conn:
        async with conn.transaction():
            if not updates:
                row = await conn.fetchrow(
                    "SELECT id, nombre, CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio, CONVERT(varchar(10), fecha_fin, 23) AS fecha_fin, dias_laborables, horas_por_dia, horas_por_persona, activo, estado, descripcion, modulo FROM pi WHERE id=$1",
                    pi_id,
                )
                return dict(row) if row else None

            old_hpp = None
            if capacity_changes:
                old_hpp = await conn.fetchval("SELECT horas_por_persona FROM pi WHERE id=$1", pi_id)

            set_parts = [f"{k} = ${i+2}" for i, k in enumerate(updates.keys())]
            await conn.execute(
                f"UPDATE pi SET {', '.join(set_parts)} WHERE id=$1",
                pi_id, *updates.values(),
            )
            row = await conn.fetchrow(
                "SELECT id, nombre, CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio, CONVERT(varchar(10), fecha_fin, 23) AS fecha_fin, dias_laborables, horas_por_dia, horas_por_persona, activo, estado, descripcion, modulo FROM pi WHERE id=$1",
                pi_id,
            )
            if not row:
                return None

            # Si cambió horas_por_persona, actualizar capacidad individual de cada persona
            # proporcionalmente (los líderes con capacidad NULL se quedan igual).
            if capacity_changes and old_hpp and old_hpp > 0:
                new_hpp = row["horas_por_persona"]
                if new_hpp and new_hpp != old_hpp:
                    caps = await conn.fetch(
                        "SELECT id, capacidad_horas FROM capacidad_persona_pi WHERE pi_id=$1",
                        pi_id,
                    )
                    for cap in caps:
                        if cap["capacidad_horas"] is None:
                            continue
                        new_cap = round(float(cap["capacidad_horas"]) / old_hpp * new_hpp)
                        await conn.execute(
                            "UPDATE capacidad_persona_pi SET capacidad_horas=$1 WHERE id=$2",
                            new_cap, cap["id"],
                        )

    return dict(row)


async def delete_pi(pool: Any, pi_id: int) -> dict | None:
    async with pool.acquire() as conn:
        async with conn.transaction():
            async def table_exists(name: str) -> bool:
                return bool(await conn.fetchval(
                    "SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA='dbo' AND TABLE_NAME=$1",
                    name,
                ))

            pi = await conn.fetchrow(
                "SELECT id, nombre, activo, modulo FROM pi WHERE id=$1",
                pi_id,
            )
            if not pi:
                return None

            counts = {
                "festivos": await conn.fetchval(
                    "SELECT COUNT(*) FROM festivos WHERE pi_id=$1", pi_id
                ) or 0,
                "capacidad_persona_pi": await conn.fetchval(
                    "SELECT COUNT(*) FROM capacidad_persona_pi WHERE pi_id=$1", pi_id
                ) or 0,
                "capacidad_proyecto_pi": await conn.fetchval(
                    "SELECT COUNT(*) FROM capacidad_proyecto_pi WHERE pi_id=$1", pi_id
                ) or 0,
                "backlog_mejora_continua": await conn.fetchval(
                    "SELECT COUNT(*) FROM backlog_mejora_continua WHERE pi_id=$1", pi_id
                ) or 0,
                "backlog_fabrica": await conn.fetchval(
                    "SELECT COUNT(*) FROM backlog_fabrica WHERE pi_id=$1", pi_id
                ) or 0,
                "backlog_incidentes": await conn.fetchval(
                    "SELECT COUNT(*) FROM backlog_incidentes WHERE pi_id=$1", pi_id
                ) or 0,
            }

            await conn.execute("DELETE FROM backlog_mejora_continua WHERE pi_id=$1", pi_id)
            await conn.execute("DELETE FROM backlog_fabrica WHERE pi_id=$1", pi_id)
            await conn.execute("DELETE FROM backlog_incidentes WHERE pi_id=$1", pi_id)

            for table in ("capacidad_semanal_persona", "pi_velocidad_historica"):
                if await table_exists(table):
                    counts[table] = await conn.fetchval(
                        f"SELECT COUNT(*) FROM {table} WHERE pi_id=$1", pi_id
                    ) or 0
                    await conn.execute(f"DELETE FROM {table} WHERE pi_id=$1", pi_id)

            if await table_exists("replanificacion_propuesta"):
                counts["replanificacion_propuesta"] = await conn.fetchval(
                    """
                    SELECT COUNT(*)
                    FROM replanificacion_propuesta
                    WHERE pi_origen_id=$1 OR pi_destino_id=$1
                    """,
                    pi_id,
                ) or 0
                await conn.execute(
                    """
                    DELETE FROM replanificacion_propuesta
                    WHERE pi_origen_id=$1 OR pi_destino_id=$1
                    """,
                    pi_id,
                )

            # Tablas legacy IBL si existen datos asociados al PI.
            ibl_ids = await conn.fetch("SELECT id FROM ibl WHERE pi_id=$1", pi_id) if await table_exists("ibl") else []
            if ibl_ids:
                ids = [r["id"] for r in ibl_ids]
                placeholders = ",".join(str(int(i)) for i in ids)
                if await table_exists("escalamientos"):
                    await conn.execute(f"DELETE FROM escalamientos WHERE ibl_id IN ({placeholders})")
                if await table_exists("ibl_entrega"):
                    await conn.execute(f"DELETE FROM ibl_entrega WHERE ibl_id IN ({placeholders})")
                if await table_exists("ibl_tracking"):
                    await conn.execute(f"DELETE FROM ibl_tracking WHERE ibl_id IN ({placeholders})")
                if await table_exists("ibl_recursos"):
                    await conn.execute(f"DELETE FROM ibl_recursos WHERE ibl_id IN ({placeholders})")
                if await table_exists("ibl_dependencias"):
                    await conn.execute(
                        f"DELETE FROM ibl_dependencias WHERE ibl_id IN ({placeholders}) OR depende_de_id IN ({placeholders})"
                    )
                await conn.execute("DELETE FROM ibl WHERE pi_id=$1", pi_id)
                counts["ibl"] = len(ids)
            else:
                counts["ibl"] = 0

            # Si el PI está activo, copiar capacidades al reemplazo ANTES de borrar.
            replacement_row = None
            if pi["activo"]:
                replacement_row = await conn.fetchrow(
                    """
                    SELECT TOP (1) id, horas_por_persona
                    FROM pi
                    WHERE modulo=$1 AND id != $2
                    ORDER BY fecha_inicio DESC, id DESC
                    """,
                    pi["modulo"], pi_id,
                )
                if replacement_row:
                    rep_id = replacement_row["id"]
                    cur_hpp = await conn.fetchval(
                        "SELECT horas_por_persona FROM pi WHERE id=$1", pi_id
                    ) or 1
                    rep_hpp = replacement_row["horas_por_persona"] or cur_hpp

                    # ── Personas ──────────────────────────────────────────
                    rep_pers = await conn.fetchval(
                        "SELECT COUNT(*) FROM capacidad_persona_pi WHERE pi_id=$1", rep_id
                    ) or 0
                    if rep_pers == 0:
                        old_caps = await conn.fetch(
                            "SELECT persona_id, proyecto_principal, capacidad_horas FROM capacidad_persona_pi WHERE pi_id=$1",
                            pi_id,
                        )
                        for cap in old_caps:
                            if cap["capacidad_horas"] is None:
                                new_cap = None
                            else:
                                new_cap = round(cap["capacidad_horas"] / cur_hpp * rep_hpp)
                            await conn.execute(
                                """IF NOT EXISTS (SELECT 1 FROM capacidad_persona_pi WHERE pi_id=$1 AND persona_id=$2)
                                   INSERT INTO capacidad_persona_pi (pi_id, persona_id, proyecto_principal, capacidad_horas)
                                   VALUES ($1, $2, $3, $4)
                                """,
                                rep_id, cap["persona_id"], cap["proyecto_principal"], new_cap,
                            )

                    # ── Proyectos ─────────────────────────────────────────
                    rep_proj = await conn.fetchval(
                        "SELECT COUNT(*) FROM capacidad_proyecto_pi WHERE pi_id=$1", rep_id
                    ) or 0
                    if rep_proj == 0:
                        old_proj = await conn.fetch(
                            "SELECT proyecto_id, cap_java_horas, cap_cobol_horas, alerta FROM capacidad_proyecto_pi WHERE pi_id=$1",
                            pi_id,
                        )
                        for pc in old_proj:
                            ratio = rep_hpp / cur_hpp if cur_hpp else 1
                            new_java  = round((pc["cap_java_horas"]  or 0) * ratio)
                            new_cobol = round((pc["cap_cobol_horas"] or 0) * ratio)
                            await conn.execute(
                                """IF NOT EXISTS (SELECT 1 FROM capacidad_proyecto_pi WHERE pi_id=$1 AND proyecto_id=$2)
                                   INSERT INTO capacidad_proyecto_pi (pi_id, proyecto_id, cap_java_horas, cap_cobol_horas, alerta)
                                   VALUES ($1, $2, $3, $4, $5)
                                """,
                                rep_id, pc["proyecto_id"], new_java, new_cobol, pc["alerta"],
                            )

            await conn.execute("DELETE FROM capacidad_persona_pi WHERE pi_id=$1", pi_id)
            await conn.execute("DELETE FROM capacidad_proyecto_pi WHERE pi_id=$1", pi_id)
            await conn.execute("DELETE FROM festivos WHERE pi_id=$1", pi_id)
            await conn.execute("DELETE FROM pi WHERE id=$1", pi_id)

            replacement = None
            if pi["activo"] and replacement_row:
                rep_id = replacement_row["id"]
                replacement = await conn.fetchrow(
                    """
                    UPDATE pi SET activo=1, estado='ACTIVO' WHERE id=$1;
                    SELECT id, nombre,
                        CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio,
                        CONVERT(varchar(10), fecha_fin, 23) AS fecha_fin,
                        dias_laborables, horas_por_dia, horas_por_persona,
                        activo, estado, descripcion, modulo
                    FROM pi WHERE id=$1
                    """,
                    rep_id,
                )

            return {
                "id": pi["id"],
                "nombre": pi["nombre"],
                "deleted": True,
                "deleted_counts": {k: int(v) for k, v in counts.items()},
                "replacement_pi": dict(replacement) if replacement else None,
            }


async def activar_pi(pool: Any, pi_id: int) -> dict | None:
    async with pool.acquire() as conn:
        async with conn.transaction():
            # Obtener el módulo del PI a activar
            target_modulo = await conn.fetchval("SELECT modulo FROM pi WHERE id=$1", pi_id)

            old_pi = await conn.fetchrow(
                "SELECT id, horas_por_persona FROM pi WHERE activo=TRUE AND id != $1 AND modulo = $2",
                pi_id, target_modulo,
            )

            # Solo cierra PIs del mismo módulo
            await conn.execute(
                "UPDATE pi SET activo=FALSE, estado='CERRADO' WHERE activo=TRUE AND id != $1 AND modulo = $2",
                pi_id, target_modulo,
            )

            row = await conn.fetchrow(
                """UPDATE pi SET activo=1, estado='ACTIVO' WHERE id=$1;
                   SELECT id, nombre,
                     CONVERT(varchar(10), fecha_inicio, 23) AS fecha_inicio,
                     CONVERT(varchar(10), fecha_fin, 23) AS fecha_fin,
                     dias_laborables, horas_por_dia, horas_por_persona,
                     activo, estado, descripcion, modulo
                   FROM pi WHERE id=$1""",
                pi_id,
            )
            if not row:
                return None

            new_horas_pp = row["horas_por_persona"] or 0

            existing_cap = await conn.fetchval(
                "SELECT COUNT(*) FROM capacidad_persona_pi WHERE pi_id=$1", pi_id
            )
            personas_copiadas = 0
            if existing_cap == 0:
                if old_pi:
                    # Copiar desde el PI anterior con escala proporcional de horas
                    old_horas_pp = old_pi["horas_por_persona"] or 1
                    old_caps = await conn.fetch(
                        "SELECT persona_id, proyecto_principal, capacidad_horas FROM capacidad_persona_pi WHERE pi_id=$1",
                        old_pi["id"],
                    )
                    for cap in old_caps:
                        if cap["capacidad_horas"] is None:
                            new_cap_horas = None
                        elif old_horas_pp > 0:
                            ratio = cap["capacidad_horas"] / old_horas_pp
                            new_cap_horas = round(ratio * new_horas_pp)
                        else:
                            new_cap_horas = cap["capacidad_horas"]

                        await conn.execute(
                            """IF NOT EXISTS (SELECT 1 FROM capacidad_persona_pi WHERE pi_id=$1 AND persona_id=$2)
                               INSERT INTO capacidad_persona_pi (pi_id, persona_id, proyecto_principal, capacidad_horas)
                               VALUES ($1, $2, $3, $4)
                            """,
                            pi_id, cap["persona_id"], cap["proyecto_principal"], new_cap_horas,
                        )
                        personas_copiadas += 1
                else:
                    # Sin PI anterior: seed automático desde el catálogo global de personas
                    all_personas = await conn.fetch(
                        "SELECT id FROM personas WHERE activo=1 ORDER BY tecnologia, nombre"
                    )
                    for p in all_personas:
                        await conn.execute(
                            """IF NOT EXISTS (SELECT 1 FROM capacidad_persona_pi WHERE pi_id=$1 AND persona_id=$2)
                               INSERT INTO capacidad_persona_pi (pi_id, persona_id, capacidad_horas)
                               VALUES ($1, $2, $3)
                            """,
                            pi_id, p["id"], new_horas_pp,
                        )
                        personas_copiadas += 1

            existing_proj = await conn.fetchval(
                "SELECT COUNT(*) FROM capacidad_proyecto_pi WHERE pi_id=$1", pi_id
            )
            proyectos_copiados = 0
            if existing_proj == 0:
                if old_pi:
                    # Copiar desde el PI anterior con escala proporcional
                    old_proj = await conn.fetch(
                        "SELECT proyecto_id, cap_java_horas, cap_cobol_horas, alerta FROM capacidad_proyecto_pi WHERE pi_id=$1",
                        old_pi["id"],
                    )
                    old_horas_pp = old_pi["horas_por_persona"] or 1
                    for pc in old_proj:
                        if new_horas_pp and old_horas_pp:
                            ratio = new_horas_pp / old_horas_pp
                            new_java  = round((pc["cap_java_horas"]  or 0) * ratio)
                            new_cobol = round((pc["cap_cobol_horas"] or 0) * ratio)
                        else:
                            new_java  = pc["cap_java_horas"]  or 0
                            new_cobol = pc["cap_cobol_horas"] or 0

                        await conn.execute(
                            """IF NOT EXISTS (SELECT 1 FROM capacidad_proyecto_pi WHERE pi_id=$1 AND proyecto_id=$2)
                               INSERT INTO capacidad_proyecto_pi (pi_id, proyecto_id, cap_java_horas, cap_cobol_horas, alerta)
                               VALUES ($1, $2, $3, $4, $5)
                            """,
                            pi_id, pc["proyecto_id"], new_java, new_cobol, pc["alerta"],
                        )
                        proyectos_copiados += 1
                else:
                    # Sin PI anterior: seed automático desde el catálogo global de proyectos
                    all_proyectos = await conn.fetch(
                        "SELECT id FROM proyectos WHERE activo=1 ORDER BY nombre"
                    )
                    for p in all_proyectos:
                        await conn.execute(
                            """IF NOT EXISTS (SELECT 1 FROM capacidad_proyecto_pi WHERE pi_id=$1 AND proyecto_id=$2)
                               INSERT INTO capacidad_proyecto_pi (pi_id, proyecto_id, cap_java_horas, cap_cobol_horas, alerta)
                               VALUES ($1, $2, 0, 0, 'VERDE')
                            """,
                            pi_id, p["id"],
                        )
                        proyectos_copiados += 1

    result = dict(row)
    result["personas_copiadas"]  = personas_copiadas
    result["proyectos_copiados"] = proyectos_copiados
    return result


async def get_festivos_pi(pool: Any, pi_id: int) -> list[dict]:
    rows = await pool.fetch(
        "SELECT id, to_char(fecha,'YYYY-MM-DD') AS fecha, nombre FROM festivos WHERE pi_id=$1 ORDER BY fecha",
        pi_id,
    )
    return [dict(r) for r in rows]


async def add_festivo(pool: Any, pi_id: int, fecha: str, nombre: str) -> dict:
    row = await pool.fetchrow("""
        IF EXISTS (SELECT 1 FROM festivos WHERE pi_id=$1 AND fecha=$2)
            UPDATE festivos SET nombre=$3 WHERE pi_id=$1 AND fecha=$2
        ELSE
            INSERT INTO festivos (pi_id, fecha, nombre) VALUES ($1, $2, $3);
        SELECT id, CONVERT(varchar(10), fecha, 23) AS fecha, nombre
        FROM festivos
        WHERE pi_id=$1 AND fecha=$2
    """, pi_id, _as_date(fecha), nombre)
    return dict(row)


async def delete_festivo(pool: Any, festivo_id: int, pi_id: int) -> bool:
    r = await pool.execute("DELETE FROM festivos WHERE id=$1 AND pi_id=$2", festivo_id, pi_id)
    return r == "DELETE 1"


async def get_alertas(pool: Any, modulo: str, pi_id: int | None = None) -> list[dict]:
    table = "backlog_fabrica" if modulo == "FABRICA" else "backlog_mejora_continua"
    if pi_id is None:
        pi_row = await pool.fetchrow(
            "SELECT id, horas_por_dia FROM pi WHERE activo=TRUE AND modulo='MEJORA_CONTINUA' LIMIT 1"
        )
    else:
        pi_row = await pool.fetchrow(
            "SELECT id, horas_por_dia FROM pi WHERE id=$1 LIMIT 1",
            pi_id,
        )
    if not pi_row:
        return []

    horas_por_dia: int = pi_row["horas_por_dia"]
    festivos_rows = await pool.fetch("SELECT fecha FROM festivos WHERE pi_id=$1", pi_row["id"])
    festivos: set[date] = {f["fecha"] for f in festivos_rows}

    rows = await pool.fetch(f"""
        SELECT
            id, ticket_key, summary, assignee, assigned_team, fecha_asignacion,
            horas_analisis_java::float,    horas_desarrollo_java::float,
            horas_pruebas_java::float,     horas_af_java::float,
            horas_analisis_cobol::float,   horas_desarrollo_cobol::float,
            horas_pruebas_cobol::float,    horas_af_cobol::float,
            horas_analisis_qa::float,      horas_af_qa::float,
            responsable_java, responsable_cobol, responsable_dialogue,
            responsable_parametria, responsable_qa,
            extra
        FROM {table}
        WHERE fecha_asignacion IS NOT NULL
          AND pi_id = $1
        ORDER BY ticket_key NULLS LAST, summary
    """, pi_row["id"])

    today = date.today()
    result = []

    for row in rows:
        fecha_asig: date | None = row["fecha_asignacion"]
        if not fecha_asig:
            continue

        items = _planificacion_items_from_extra(row["extra"])
        if items:
            java  = sum(i["horas"] for i in items if i["perfil"] == "java")
            cobol = sum(i["horas"] for i in items if i["perfil"] == "cobol")
            gestion = sum(i["horas"] for i in items if i["perfil"] == "gestion")
            calidad = sum(i["horas"] for i in items if i["perfil"] == "calidad")
            qa = calidad
        else:
            gestion = 0
            calidad = 0
            java  = sum(float(row[c] or 0) for c in [
                "horas_analisis_java", "horas_desarrollo_java",
                "horas_pruebas_java", "horas_af_java"])
            cobol = sum(float(row[c] or 0) for c in [
                "horas_analisis_cobol", "horas_desarrollo_cobol",
                "horas_pruebas_cobol", "horas_af_cobol"])
            calidad = sum(float(row[c] or 0) for c in ["horas_analisis_qa", "horas_af_qa"])
            qa = calidad

        dev_horas = max(java, cobol)
        if dev_horas <= 0:
            continue

        dias_dev = math.ceil(dev_horas / horas_por_dia)
        fecha_fin_dev = _add_working_days(fecha_asig, dias_dev, festivos)
        alerta_dev = _calc_alerta(today, fecha_asig, fecha_fin_dev)

        fecha_fin_qa_iso: str | None = None
        alerta_qa: str | None = None
        if qa > 0:
            dias_qa = math.ceil(qa / horas_por_dia)
            fecha_fin_qa = _add_working_days(fecha_fin_dev, dias_qa, festivos)
            fecha_fin_qa_iso = fecha_fin_qa.isoformat()
            alerta_qa = _calc_alerta(today, fecha_fin_dev, fecha_fin_qa)

        result.append({
            "id": row["id"],
            "ticket_key": row["ticket_key"],
            "summary": row["summary"],
            "assignee": row["assignee"],
            "equipo": row["assigned_team"],
            "equipo_trabajo": ", ".join(_responsables_trabajo(row, items)) or None,
            "fecha_asignacion": fecha_asig.isoformat(),
            "fecha_fin_desarrollo": fecha_fin_dev.isoformat(),
            "fecha_fin_qa": fecha_fin_qa_iso,
            "alerta_desarrollo": alerta_dev,
            "alerta_qa": alerta_qa,
            "java_horas": java,
            "cobol_horas": cobol,
            "gestion_horas": gestion,
            "calidad_horas": calidad,
            "qa_horas": qa,
        })

    return result
