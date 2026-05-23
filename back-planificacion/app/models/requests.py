from pydantic import BaseModel
from typing import Optional


class ChatRequest(BaseModel):
    session_id: str
    message: str


class InitSessionRequest(BaseModel):
    user: str = "planificador"


class AsignarResponsableRequest(BaseModel):
    nombre: str


class CreatePiRequest(BaseModel):
    nombre: str
    fecha_inicio: str
    fecha_fin: str
    dias_laborables: int
    horas_por_dia: int = 8
    descripcion: Optional[str] = None


class UpdatePiRequest(BaseModel):
    nombre: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    dias_laborables: Optional[int] = None
    horas_por_dia: Optional[int] = None
    descripcion: Optional[str] = None
    estado: Optional[str] = None


class AddFestivoRequest(BaseModel):
    fecha: str
    nombre: str


class AddPersonaCapacidadRequest(BaseModel):
    nombre: str
    apellidos: str
    tecnologia: str
    modulo: str = "FABRICA"


class UpdatePersonaCapacidadRequest(BaseModel):
    nombre: Optional[str] = None
    capacidad_horas: Optional[float] = None
    reserva_estimacion_horas: Optional[float] = None
    reserva_estimacion_periodo: Optional[str] = None
    senior: Optional[bool] = None


class NovedadDisponibilidadRequest(BaseModel):
    persona_id: int
    tipo: str
    fecha_inicio: str
    fecha_fin: str
    horas_por_dia: Optional[float] = None
    descripcion: Optional[str] = None


class AddProyectoCapacidadRequest(BaseModel):
    nombre: str
    identi: str
    modulo: str


class FechaAsignacionRequest(BaseModel):
    fecha_asignacion: Optional[str] = None


class FechaFinalizacionRequest(BaseModel):
    fecha_finalizacion: Optional[str] = None


class FechaComprometidaClienteRequest(BaseModel):
    fecha_finalizacion_inicial: Optional[str] = None


class EscalamientoItemRequest(BaseModel):
    fecha_escalado: str
    fecha_reinicio: Optional[str] = None


class EscalamientoRequest(BaseModel):
    escalados: list[EscalamientoItemRequest] = []


class StatusRequest(BaseModel):
    status: str


class CreateBacklogRequest(BaseModel):
    ticket_key: Optional[str] = None
    summary: str
    issue_type: Optional[str] = None
    project: Optional[str] = None
    status: Optional[str] = "Backlog"
    assigned_team: Optional[str] = None
    assignee: Optional[str] = None
    reporter: Optional[str] = None
    epic_link: Optional[str] = None
    priority: Optional[str] = None
    story_points: Optional[float] = None
    sprint: Optional[str] = None
    labels: Optional[str] = None
    components: Optional[str] = None
    fix_version: Optional[str] = None
    fecha_asignacion: Optional[str] = None
    fecha_finalizacion_inicial: Optional[str] = None


class PlanificacionItemRequest(BaseModel):
    responsable: Optional[str] = None
    perfil: str
    fase: str
    horas: Optional[float] = None
    tarea: Optional[str] = None
    subtarea: Optional[str] = None
    status: Optional[str] = None
    observacion: Optional[str] = None
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    fecha_escalamiento: Optional[str] = None
    pi: Optional[str] = None


class PlanificacionRequest(BaseModel):
    # Responsable por tecnología
    responsable_java:       Optional[str] = None
    responsable_cobol:      Optional[str] = None
    responsable_dialogue:   Optional[str] = None
    responsable_parametria: Optional[str] = None
    responsable_qa:         Optional[str] = None
    fecha_asignacion:       Optional[str] = None
    # ANALISIS
    horas_analisis_java:       Optional[float] = None
    horas_analisis_cobol:      Optional[float] = None
    horas_analisis_dialogue:   Optional[float] = None
    horas_analisis_parametria: Optional[float] = None
    horas_analisis_qa:         Optional[float] = None
    # DESARROLLO
    horas_desarrollo_java:       Optional[float] = None
    horas_desarrollo_cobol:      Optional[float] = None
    horas_desarrollo_dialogue:   Optional[float] = None
    horas_desarrollo_parametria: Optional[float] = None
    # PRUEBAS
    horas_pruebas_java:       Optional[float] = None
    horas_pruebas_cobol:      Optional[float] = None
    horas_pruebas_dialogue:   Optional[float] = None
    horas_pruebas_parametria: Optional[float] = None
    # AF. RIESGO
    horas_af_java:       Optional[float] = None
    horas_af_cobol:      Optional[float] = None
    horas_af_dialogue:   Optional[float] = None
    horas_af_parametria: Optional[float] = None
    horas_af_qa:         Optional[float] = None
    planificacion_items: Optional[list[PlanificacionItemRequest]] = None


class PlanItemPatchRequest(BaseModel):
    fecha_inicio: Optional[str] = None
    fecha_fin: Optional[str] = None
    status: Optional[str] = None
    pi: Optional[str] = None
