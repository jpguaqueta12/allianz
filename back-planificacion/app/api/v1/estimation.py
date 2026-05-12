from __future__ import annotations
from fastapi import APIRouter, HTTPException, UploadFile, File
from fastapi.responses import Response
from pydantic import BaseModel, Field
from app.services.estimation_service import generate_estimation
from app.services.file_extractor import extract_text
from app.services.word_generator import generate_word
from app.db.connection import get_pool
from app.db.queries import get_pi_activo
import re
from datetime import date
import structlog

logger = structlog.get_logger()

router = APIRouter()

class EstimationRequest(BaseModel):
    requerimiento: str = Field(..., min_length=10, description="Descripción del requerimiento a estimar")
    fuente_adicional: str | None = Field(None, description="Datos adicionales de cualquier fuente (pegar texto libre)")
    incluir_contexto_pi: bool = Field(False, description="Enriquecer la estimación con el backlog del PI activo")


MAX_FILE_SIZE = 20 * 1024 * 1024  # 20 MB


@router.post("/estimation/extract-file")
async def extract_file(file: UploadFile = File(...)):
    """
    Extrae texto de un archivo subido (PDF, Word, Excel, CSV, TXT, etc.)
    y lo devuelve listo para usarse como fuente adicional en la estimación.
    """
    content = await file.read()

    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="El archivo supera el límite de 20 MB")

    try:
        result = extract_text(content, file.filename or "archivo")
        return {
            "text": result["text"],
            "meta": result["meta"],
        }
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))


@router.post("/estimation/estimar")
async def estimar(body: EstimationRequest):
    """
    Genera una estimación paramétrica y trazable para el requerimiento indicado.
    Soporta datos de cualquier fuente y aplica chunking automático para entradas grandes.
    """
    pi_context: str | None = None

    if body.incluir_contexto_pi:
        try:
            pool = get_pool()
            pi = await get_pi_activo(pool)
            if pi:
                pi_context = (
                    f"PI Activo: {pi['nombre']} ({pi['fecha_inicio']} → {pi['fecha_fin']})\n"
                    f"Días laborables: {pi['dias_laborables']} | Horas por persona: {pi['horas_por_persona']}"
                )
        except Exception as exc:
            logger.warning("pi_context_error", error=str(exc))

    try:
        result = await generate_estimation(
            requerimiento=body.requerimiento,
            fuente_adicional=body.fuente_adicional,
            pi_context=pi_context,
        )
        return result
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))
    except Exception as exc:
        logger.error("estimation_endpoint_error", error=str(exc))
        raise HTTPException(status_code=500, detail="Error interno generando la estimación")


@router.post("/estimation/export-word")
async def export_word(data: dict):
    """
    Recibe el resultado JSON de una estimación y genera un documento Word corporativo.
    """
    try:
        doc_bytes = generate_word(data)
        titulo    = data.get("titulo", "estimacion")
        safe_name = re.sub(r"[^\w\-]", "_", titulo)[:60]
        filename  = f"Estimacion_{safe_name}_{date.today().strftime('%Y%m%d')}.docx"
        return Response(
            content=doc_bytes,
            media_type="application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            headers={"Content-Disposition": f'attachment; filename="{filename}"'},
        )
    except Exception as exc:
        logger.error("export_word_error", error=str(exc))
        raise HTTPException(status_code=500, detail=f"Error generando el documento Word: {exc}")
