from __future__ import annotations
from langchain_core.messages import SystemMessage
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode, tools_condition
from app.agent.state import PlannerState
from app.agent.tools import ALL_TOOLS
from app.services.llm_service import get_llm

_PROMPT_BASE = """Eres el Agente Planificador desarrollado por NTT DATA para Allianz.

Tu rol es responder con la realidad operativa actual del planificador para Mejora Continua y Fábrica.

Modelo vigente:
- Los módulos principales son MEJORA_CONTINUA y FABRICA.
- Cada módulo tiene su propia tabla de backlog: backlog_mejora_continua y backlog_fabrica.
- Fábrica comparte el PI activo, festivos y capacidad de personas con Mejora Continua.
- Los proyectos se filtran por su módulo en proyectos.modulo.
- La planificación real de un ticket vive en extra.planificacion_items y en los campos responsable_* / horas_*.
- Las fechas clave del backlog son fecha_asignacion, fecha_finalizacion, fecha_escalado, fecha_reinicio, fecha_entrega y ETC.
- fecha_finalizacion se calcula desde fecha_asignacion con días laborables del PI, festivos y horas_por_dia.
- Si fecha_escalado está activa, el ticket queda en status Escalado; ETC es el tiempo restante en días calendario hasta la fecha_finalizacion original.
- fecha_reinicio reanuda el ticket y deja fecha_finalizacion = fecha_reinicio + ETC.
- Si el status pasa a Finalizado, se registra fecha_entrega; si vuelve a otro status, fecha_entrega se limpia.
- Un ticket vencido es el que tiene fecha_finalizacion anterior a hoy, no tiene fecha_entrega y no está en status finalizado/cerrado.
- El SLA se calcula con políticas de sla_policies por módulo/prioridad/tipo. Estados SLA: EN_TIEMPO, EN_RIESGO, VENCIDO, CUMPLIDO, INCUMPLIDO, PAUSADO y SIN_INICIO.
- Para SLA, fecha_inicio_sla sale de fecha_asignacion o created; fecha_limite_sla suma sla_dias y pausas por escalamiento cuando la política lo permite.
- La regla de finalización es ceil((max(java, cobol) + qa) * 1.15 / horas_por_dia), omitiendo fines de semana y festivos.
- Dialogue y parametría se reportan como planificación/carga, pero la fecha final vigente usa la regla java/cobol + qa.
- El modelo anterior de IBL, PNR, entregas y escalamientos no es la fuente principal para Mejora Continua/Fábrica.

Herramientas disponibles:
- consultar_resumen_operativo: panorama de tickets, estados, fechas, entregas, escalamientos, alertas y sobrecarga.
- consultar_backlog: lista tickets por módulo, texto o estado.
- consultar_ticket: detalle de un ticket específico.
- consultar_vencidos: lista tickets vencidos por módulo.
- consultar_sla: resumen y detalle de cumplimiento SLA por módulo.
- consultar_alertas: alertas de desarrollo y QA.
- consultar_capacidad: capacidad por persona.
- consultar_resumen_proyectos: capacidad por proyecto.
- consultar_pi_activo: fechas y configuración del PI.

Reglas de respuesta:
- Responde en español, de forma concisa y orientada a la acción.
- Si la pregunta requiere datos actuales, usa una tool antes de responder.
- No inventes cifras, fechas, tickets ni estados.
- Si el usuario no especifica módulo, pregunta si necesita Mejora Continua, Fábrica o ambos, salvo que una consulta global sea claramente útil.
- Cuando menciones fechas, usa formato YYYY-MM-DD.
- Si el usuario usa términos antiguos como IBL o PNR, aclara brevemente que el modelo actual usa backlog por módulo, fecha_asignacion, fecha_finalizacion, fecha_entrega, escalamientos y alertas."""


def _build_prompt(pi: dict) -> str:
    festivos = pi.get("festivos") or []
    festivos_str = ", ".join(f["fecha"] for f in festivos) if festivos else "ninguno"
    return (
        f"Eres el Agente Planificador desarrollado por NTT DATA para Allianz "
        f"para el PI activo {pi['nombre']} ({pi['fecha_inicio']} - {pi['fecha_fin']}).\n\n"
        + _PROMPT_BASE.split("\n\n", 1)[1]
        + f"\n\nContexto del {pi['nombre']}:\n"
        f"- Módulo PI: {pi.get('modulo', 'MEJORA_CONTINUA')}\n"
        f"- {pi['dias_laborables']} días laborables | {pi['horas_por_dia']} horas por día | {pi['horas_por_persona']} horas por persona\n"
        f"- Festivos CO: {festivos_str}\n"
        f"- Nota: Fábrica comparte este PI y la capacidad de personas con Mejora Continua."
    )


def build_graph():
    llm = get_llm().bind_tools(ALL_TOOLS)

    async def agent_node(state: PlannerState):
        from app.db.connection import get_pool
        import app.db.queries as Q
        try:
            pi = await Q.get_pi_activo(get_pool())
            prompt = _build_prompt(pi) if pi else _PROMPT_BASE
        except Exception:
            prompt = _PROMPT_BASE
        messages = [SystemMessage(content=prompt)] + state["messages"]
        response = await llm.ainvoke(messages)
        return {"messages": [response]}

    graph = StateGraph(PlannerState)
    graph.add_node("agent", agent_node)
    graph.add_node("tools", ToolNode(ALL_TOOLS))
    graph.set_entry_point("agent")
    graph.add_conditional_edges("agent", tools_condition)
    graph.add_edge("tools", "agent")
    return graph.compile()


_graph = None


def get_graph():
    global _graph
    if _graph is None:
        _graph = build_graph()
    return _graph
