from __future__ import annotations
import json
import re
from app.services.llm_service import get_llm
import structlog

logger = structlog.get_logger()

CHUNK_SIZE = 6000
CHUNK_OVERLAP = 600
MAX_DIRECT_SIZE = 9000

SYSTEM_PROMPT = """Eres un agente de estimación de software especializado en proyectos bancarios y de seguros para equipos NTT DATA / Allianz.

OBJETIVO: Construir estimaciones paramétricas, trazables, basadas en drivers reales, reproducibles y completamente defendibles ante PMO y Arquitectura.

══════════════════════════════════════════════════════
REGLAS ESTRICTAS — INCUMPLIRLAS INVALIDA LA ESTIMACIÓN
══════════════════════════════════════════════════════
1. NUNCA estimes sin mapear drivers explícitamente por categoría
2. SIEMPRE calcula pruebas técnicas = 10% del total de construcción
3. SIEMPRE calcula QA = 10% del total de construcción
4. SIEMPRE incluye documentación (mínimo 1h, escala según complejidad)
5. SIEMPRE incluye despliegue (mínimo: 1h pack entrega + 1h documentación)
6. NUNCA mezcles análisis con construcción en la misma categoría
7. NUNCA uses "depende" sin cuantificar el impacto en horas
8. Si falta información, asume el caso más simple y lo documenta como supuesto

═══════════════════════════════════════════════════
TABLA DE HORAS DE REFERENCIA POR DRIVER
═══════════════════════════════════════════════════

── ANÁLISIS ──────────────────────────────────────
• Interpretación inicial:            2h
• Desglose de funcionalidades:       3h
• Análisis funcional:                4h
• Diseño técnico:                    4h
• Diseño set de pruebas:             2h

── CONSTRUCCIÓN JAVA ─────────────────────────────
• Modificación proceso Java:         simple=8h  media=16h  compleja=32h
• Validaciones Java:                 2.5h por validación
• Web service CREACIÓN REST:         simple=16h media=24h  compleja=40h
• Web service CONSUMO REST:          simple=8h  media=16h  compleja=24h
• Wrapper:                           20h
• SpringBatch:                       simple=16h media=32h  compleja=56h
• Interacción directa BD:            5h por módulo/consulta
• Test unitarios:                    4h por clase de prueba

── APIGEE ────────────────────────────────────────
• Api-in nuevo:                      8h
• Api-out modificación:              4h
• Política (KVM / OAuth / headers):  3h por política

── CONSTRUCCIÓN COBOL ────────────────────────────
• Validaciones / alertas:            3h por validación
• Modificación programa:             simple=5.6h media=11h compleja=22h
• Creación módulo online:            simple=16h  media=32h
• Creación módulo batch:             simple=24h  media=40h
• Modificación copy:                 4h
• Búsqueda de copys:                 2h
• JCL:                               simple=4h  compleja=8h
• Proceso batch preparación:         16h
• Proceso batch reporte:             20h

── PRUEBAS TÉCNICAS ──────────────────────────────
  Calculado automáticamente: 10% × total_construccion

── QA ────────────────────────────────────────────
  Calculado automáticamente: 10% × total_construccion

── DOCUMENTACIÓN ─────────────────────────────────
• Requerimiento simple:              1h – 2h
• Requerimiento medio:               2h – 4h
• Requerimiento complejo:            4h – 8h

── DESPLIEGUE ────────────────────────────────────
• Pack entrega:                      mínimo 1h
• Documentación de despliegue:       1h
• Coordinación pase a producción:    2h (si aplica)

═══════════════════════════════════════════════════
NIVELES DE COMPLEJIDAD
═══════════════════════════════════════════════════
• Baja:    ≤ 40h de construcción
• Media:   41h – 120h de construcción
• Alta:    > 120h de construcción
• Crítica: > 200h O impacto multi-sistema

═══════════════════════════════════════════════════
FACTOR DE RIESGO
═══════════════════════════════════════════════════
• Bajo    (+0%):  Sin factores de riesgo
• Medio   (+10%): Cambios batch productivo OR impacto financiero OR integración externa
• Alto    (+20%): Dependencias no definidas OR datos no estructurados OR mainframe sin doc parcial
• Crítico (+30%): Mainframe legacy sin documentación OR múltiples factores simultáneos

═══════════════════════════════════════════════════
DISTRIBUCIÓN POR PERFILES
═══════════════════════════════════════════════════
• Análisis + Diseño técnico  → Analista (60%) + Líder Técnico (40%)
• Construcción Java          → Dev Java
• Construcción COBOL         → Dev COBOL
• APIGEE                     → Dev Java
• Pruebas técnicas           → Dev correspondiente (Java o COBOL según peso)
• QA                         → QA
• Documentación              → Analista
• Despliegue                 → DevOps (70%) + Líder Técnico (30%)

══════════════════════════════════════════════════════
FORMATO DE SALIDA OBLIGATORIO
══════════════════════════════════════════════════════
Responde ÚNICAMENTE con JSON válido (sin texto extra, sin markdown). Estructura exacta:

{
  "titulo": "string",
  "resumen_requerimiento": "string (2-3 oraciones)",
  "categorias": {
    "analisis": {
      "drivers": [
        {"nombre": "string", "cantidad": number, "horas_unitarias": number, "total_horas": number, "descripcion": "string"}
      ],
      "subtotal": number
    },
    "java": { "drivers": [...], "subtotal": number },
    "cobol": { "drivers": [...], "subtotal": number },
    "apigee": { "drivers": [...], "subtotal": number },
    "pruebas_tecnicas": {
      "drivers": [{"nombre": "Pruebas Técnicas 10%", "cantidad": 1, "horas_unitarias": number, "total_horas": number, "descripcion": "10% de Xh de construcción total"}],
      "subtotal": number
    },
    "qa": {
      "drivers": [{"nombre": "QA 10%", "cantidad": 1, "horas_unitarias": number, "total_horas": number, "descripcion": "10% de Xh de construcción total"}],
      "subtotal": number
    },
    "documentacion": { "drivers": [...], "subtotal": number },
    "despliegue": { "drivers": [...], "subtotal": number }
  },
  "totales": {
    "total_analisis": number,
    "total_construccion": number,
    "total_pruebas_tecnicas": number,
    "total_qa": number,
    "total_documentacion": number,
    "total_despliegue": number,
    "subtotal_sin_riesgo": number
  },
  "nivel_complejidad": "Baja" | "Media" | "Alta" | "Crítica",
  "factor_riesgo": {
    "nivel": "Bajo" | "Medio" | "Alto" | "Crítico",
    "porcentaje": number,
    "razones": ["string"],
    "horas_riesgo": number
  },
  "total_final": number,
  "perfiles": [
    {"perfil": "Analista", "horas": number},
    {"perfil": "Dev Java", "horas": number},
    {"perfil": "Dev COBOL", "horas": number},
    {"perfil": "QA", "horas": number},
    {"perfil": "Líder Técnico", "horas": number},
    {"perfil": "DevOps", "horas": number}
  ],
  "supuestos": ["string"],
  "observaciones": ["string"]
}"""

EXTRACTION_PROMPT = """Eres un extractor técnico de requisitos de software. Analiza el fragmento de texto y extrae SOLO la información relevante para estimación de esfuerzo.

Responde ÚNICAMENTE con JSON válido:
{
  "funcionalidades": ["lista de funcionalidades o cambios técnicos identificados"],
  "tecnologias": ["Java", "COBOL", "APIGEE", "BD", etc.],
  "integraciones": ["servicios externos, APIs, sistemas con los que se integra"],
  "restricciones": ["restricciones técnicas, de tiempo o de negocio"],
  "contexto_estimacion": "texto breve con datos clave para la estimación (complejidad, volumen, etc.)"
}"""


def _extract_json(text: str) -> dict:
    text = text.strip()
    match = re.search(r'```(?:json)?\s*([\s\S]*?)```', text)
    if match:
        text = match.group(1).strip()
    start = text.find('{')
    end = text.rfind('}')
    if start != -1 and end != -1:
        text = text[start:end + 1]
    return json.loads(text)


def _chunk_text(text: str) -> list[str]:
    if len(text) <= CHUNK_SIZE:
        return [text]
    chunks: list[str] = []
    start = 0
    while start < len(text):
        end = min(start + CHUNK_SIZE, len(text))
        chunks.append(text[start:end])
        if end == len(text):
            break
        start = end - CHUNK_OVERLAP
    return chunks


async def _extract_from_chunk(chunk: str) -> dict:
    llm = get_llm()
    messages = [
        {"role": "system", "content": EXTRACTION_PROMPT},
        {"role": "user", "content": chunk},
    ]
    resp = await llm.ainvoke(messages)
    try:
        return _extract_json(resp.content)
    except Exception:
        return {
            "funcionalidades": [],
            "tecnologias": [],
            "integraciones": [],
            "restricciones": [],
            "contexto_estimacion": chunk[:800],
        }


def _build_context_from_extractions(extractions: list[dict]) -> str:
    funcs: list[str] = []
    techs: set[str] = set()
    ints: list[str] = []
    rests: list[str] = []
    ctx_parts: list[str] = []

    for ext in extractions:
        funcs.extend(ext.get("funcionalidades", []))
        techs.update(ext.get("tecnologias", []))
        ints.extend(ext.get("integraciones", []))
        rests.extend(ext.get("restricciones", []))
        c = ext.get("contexto_estimacion", "")
        if c:
            ctx_parts.append(c)

    parts: list[str] = []
    if funcs:
        parts.append("FUNCIONALIDADES:\n" + "\n".join(f"  • {f}" for f in funcs))
    if techs:
        parts.append("TECNOLOGÍAS: " + ", ".join(sorted(techs)))
    if ints:
        parts.append("INTEGRACIONES:\n" + "\n".join(f"  • {i}" for i in ints))
    if rests:
        parts.append("RESTRICCIONES:\n" + "\n".join(f"  • {r}" for r in rests))
    if ctx_parts:
        parts.append("CONTEXTO ADICIONAL:\n" + "\n---\n".join(ctx_parts))

    return "\n\n".join(parts)


async def generate_estimation(
    requerimiento: str,
    fuente_adicional: str | None = None,
    pi_context: str | None = None,
) -> dict:
    """
    Generate a structured parametric estimation.
    Applies chunking when the combined input exceeds MAX_DIRECT_SIZE.
    """
    llm = get_llm()

    combined_parts = [requerimiento]
    if fuente_adicional:
        combined_parts.append(f"FUENTE ADICIONAL:\n{fuente_adicional}")
    if pi_context:
        combined_parts.append(f"CONTEXTO DEL PI ACTIVO:\n{pi_context}")

    combined = "\n\n".join(combined_parts)

    if len(combined) > MAX_DIRECT_SIZE:
        logger.info("estimation_chunking_required", chars=len(combined))
        chunks = _chunk_text(combined)
        extractions = []
        for idx, chunk in enumerate(chunks):
            logger.info("processing_chunk", index=idx + 1, total=len(chunks))
            ext = await _extract_from_chunk(chunk)
            extractions.append(ext)

        context_summary = _build_context_from_extractions(extractions)
        estimation_input = (
            f"REQUERIMIENTO ORIGINAL:\n{requerimiento}\n\n"
            f"INFORMACIÓN COMPLEMENTARIA EXTRAÍDA Y CONSOLIDADA:\n{context_summary}"
        )
        logger.info("chunking_complete", chunks=len(chunks), summary_chars=len(estimation_input))
    else:
        estimation_input = combined

    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
        {"role": "user", "content": f"Estima el siguiente requerimiento:\n\n{estimation_input}"},
    ]

    resp = await llm.ainvoke(messages)

    try:
        result = _extract_json(resp.content)
        logger.info("estimation_done", titulo=result.get("titulo", "?"), total=result.get("total_final", "?"))
        return result
    except Exception as exc:
        logger.error("estimation_parse_error", error=str(exc), snippet=resp.content[:400])
        raise ValueError(f"El modelo retornó una respuesta no parseable: {exc}")
