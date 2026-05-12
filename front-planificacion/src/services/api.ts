import { AlertaItem, DashboardData, EstimacionResult, Festivo, PiInfo } from '../types'

const API_ORIGIN = import.meta.env.VITE_API_BASE_URL ?? ''
const BASE = `${API_ORIGIN}/api/v1`

// ── Auth helpers ──────────────────────────────────────────────────────────────

function getAuthHeaders(): Record<string, string> {
  try {
    const raw = localStorage.getItem('auth-storage')
    if (!raw) return {}
    const { state } = JSON.parse(raw) as { state: { token: string | null } }
    if (!state?.token) return {}
    return { Authorization: `Bearer ${state.token}` }
  } catch {
    return {}
  }
}

async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = { 'Content-Type': 'application/json', ...getAuthHeaders(), ...(init.headers as Record<string, string> ?? {}) }
  return fetch(input, { ...init, headers })
}

export async function loginSuperUser(
  username: string,
  password: string,
): Promise<{ access_token: string; token_type: string }> {
  const r = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password }),
  })
  if (!r.ok) {
    const e = await r.json().catch(() => ({ detail: 'Credenciales incorrectas' }))
    throw new Error(e.detail ?? 'Error de autenticación')
  }
  return r.json()
}

export async function verifyToken(): Promise<{ valid: boolean; role: 'superuser' | 'user' | null }> {
  try {
    const r = await authFetch(`${BASE}/auth/me/any`)
    if (!r.ok) return { valid: false, role: null }
    const data = await r.json()
    return { valid: true, role: data.role ?? null }
  } catch {
    return { valid: false, role: null }
  }
}

export async function createSession(): Promise<{ session_id: string }> {
  const r = await fetch(`${BASE}/session`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user: 'planificador' }),
  })
  if (!r.ok) throw new Error('Error creando sesión')
  return r.json()
}

export async function startChat(
  session_id: string,
  message: string,
): Promise<{ stream_url: string; session_id: string }> {
  const r = await fetch(`${BASE}/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ session_id, message }),
  })
  if (!r.ok) throw new Error('Error iniciando chat')
  const data = await r.json()
  if (data.stream_url?.startsWith('/')) {
    data.stream_url = `${API_ORIGIN}${data.stream_url}`
  }
  return data
}

function withPi(path: string, piId?: number | null): string {
  return piId ? `${path}?pi_id=${piId}` : path
}

export async function getDashboard(piId?: number | null): Promise<DashboardData> {
  const r = await fetch(withPi(`${BASE}/dashboard`, piId))
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error cargando dashboard' })); throw new Error(e.detail) }
  return r.json()
}

export async function getFabricaDashboard(piId?: number | null): Promise<DashboardData> {
  const r = await fetch(withPi(`${BASE}/dashboard/fabrica`, piId))
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error cargando dashboard de fábrica' })); throw new Error(e.detail) }
  return r.json()
}

export async function getIncidentesDashboard(): Promise<DashboardData> {
  const r = await fetch(`${BASE}/dashboard/incidentes`)
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error cargando dashboard de incidentes' })); throw new Error(e.detail) }
  return r.json()
}

// ── Capacidad personas ────────────────────────────────────────────────────────

export async function crearPersonaEnCapacidad(
  piId: number,
  body: { nombre: string; apellidos: string; tecnologia: string },
): Promise<void> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/capacidad/nueva-persona`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
}

export async function removePersonaCapacidad(piId: number, personaId: number): Promise<void> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/capacidad/personas/${personaId}`, { method: 'DELETE' })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
}

export async function sincronizarCapacidadAPI(piId: number): Promise<{ actualizado: number; horas_por_persona: number }> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/capacidad/sincronizar`, { method: 'POST' })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
  return r.json()
}

export async function crearProyectoEnCapacidad(
  piId: number,
  body: { nombre: string; identi: string; modulo: string },
): Promise<void> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/proyectos/nuevo`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
}

export async function removeProyectoCapacidad(piId: number, proyectoId: number): Promise<void> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/proyectos/${proyectoId}`, { method: 'DELETE' })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
}

// ── Alertas ───────────────────────────────────────────────────────────────────

export async function getAlertas(modulo: string, piId?: number | null): Promise<AlertaItem[]> {
  const r = await fetch(withPi(`${BASE}/alertas/${modulo}`, piId))
  if (!r.ok) throw new Error('Error cargando alertas')
  return r.json()
}

export interface SlaPolicy {
  id: number | null
  modulo: string
  issue_type: string | null
  priority: string | null
  nombre: string
  sla_dias: number
  alerta_pct: number
  pausa_escalado: boolean
  activo: boolean
}

export interface SlaTicket {
  id: number
  ticket_key: string | null
  summary: string
  status: string | null
  issue_type: string | null
  priority: string | null
  assignee: string | null
  fecha_inicio_sla: string | null
  fecha_limite_sla: string | null
  fecha_entrega: string | null
  fecha_escalado: string | null
  fecha_reinicio: string | null
  sla_dias: number
  pausa_dias: number
  consumido_dias: number
  restante_dias: number | null
  progreso_pct: number
  estado_sla: 'EN_TIEMPO' | 'EN_RIESGO' | 'VENCIDO' | 'CUMPLIDO' | 'INCUMPLIDO' | 'PAUSADO' | 'SIN_INICIO'
  policy: {
    id: number | null
    nombre: string
    issue_type: string | null
    priority: string | null
    alerta_pct: number
    pausa_escalado: boolean
  }
}

export interface SlaReport {
  modulo: string
  pi_id: number | null
  fecha_referencia: string
  policies: SlaPolicy[]
  summary: {
    total: number
    por_estado: Record<string, number>
    cumplidos: number
    incumplidos: number
    vencidos: number
    en_riesgo: number
    pausados: number
    sin_inicio: number
    abiertos: number
    cumplimiento_pct: number
  }
  tickets: SlaTicket[]
}

export async function getSlaReport(modulo: string, piId?: number | null): Promise<SlaReport> {
  const r = await fetch(withPi(`${BASE}/sla/${modulo}`, piId))
  if (!r.ok) throw new Error('Error cargando SLA')
  return r.json()
}

// ── Backlog ───────────────────────────────────────────────────────────────────

export async function getBacklog(modulo: string, piId?: number | null) {
  const r = await fetch(withPi(`${BASE}/backlog/${modulo}`, piId))
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error cargando backlog' })); throw new Error(e.detail) }
  return r.json()
}

export type PlanificacionPerfil = 'java' | 'cobol' | 'dialogue' | 'parametria' | 'qa'
export type PlanificacionFase = 'analisis' | 'desarrollo' | 'pruebas' | 'af'

export interface PlanificacionItem {
  responsable: string | null
  perfil: PlanificacionPerfil
  fase: PlanificacionFase
  horas: number | null
}

export interface PlanificacionData {
  responsable_java: string | null
  responsable_cobol: string | null
  responsable_dialogue: string | null
  responsable_parametria: string | null
  responsable_qa: string | null
  horas_analisis_java: number | null
  horas_analisis_cobol: number | null
  horas_analisis_dialogue: number | null
  horas_analisis_parametria: number | null
  horas_analisis_qa: number | null
  horas_desarrollo_java: number | null
  horas_desarrollo_cobol: number | null
  horas_desarrollo_dialogue: number | null
  horas_desarrollo_parametria: number | null
  horas_pruebas_java: number | null
  horas_pruebas_cobol: number | null
  horas_pruebas_dialogue: number | null
  horas_pruebas_parametria: number | null
  horas_af_java: number | null
  horas_af_cobol: number | null
  horas_af_dialogue: number | null
  horas_af_parametria: number | null
  horas_af_qa: number | null
  planificacion_items?: PlanificacionItem[]
  fecha_asignacion?: string | null
}

export interface ResponsableDisponible {
  id: number
  nombre: string
  tecnologia: 'JAVA' | 'COBOL'
  rol: string
  capacidad_horas: number
  horas_asignadas: number
  horas_restantes: number
  al_tope: boolean
}

export async function getResponsables(modulo: string, piId?: number | null): Promise<ResponsableDisponible[]> {
  const r = await fetch(withPi(`${BASE}/backlog/${modulo}/responsables`, piId))
  if (!r.ok) throw new Error('Error cargando responsables')
  return r.json()
}

export async function updateFechaAsignacion(
  modulo: string,
  ticketId: number,
  fecha: string | null,
): Promise<{ ok: boolean; fecha_finalizacion: string | null }> {
  const r = await fetch(`${BASE}/backlog/${modulo}/${ticketId}/fecha-asignacion`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ fecha_asignacion: fecha }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error guardando fecha' }))
    throw new Error(err.detail ?? 'Error guardando fecha')
  }
  return r.json()
}

export interface EscalamientoData {
  fecha_escalado: string | null
  fecha_reinicio: string | null
}

export interface EscalamientoResponse extends EscalamientoData {
  ok: boolean
  fecha_finalizacion: string | null
  etc: number
  status: string | null
}

export async function updateEscalamiento(
  modulo: string,
  ticketId: number,
  data: EscalamientoData,
): Promise<EscalamientoResponse> {
  const r = await fetch(`${BASE}/backlog/${modulo}/${ticketId}/escalamiento`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error guardando escalamiento' }))
    throw new Error(err.detail ?? 'Error guardando escalamiento')
  }
  return r.json()
}

export async function updateBacklogStatus(
  modulo: string,
  ticketId: number,
  status: string,
): Promise<{ ok: boolean; status: string; fecha_entrega: string | null }> {
  const r = await fetch(`${BASE}/backlog/${modulo}/${ticketId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status }),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error guardando status' }))
    throw new Error(err.detail ?? 'Error guardando status')
  }
  return r.json()
}

export async function updatePlanificacion(
  modulo: string,
  ticketId: number,
  data: PlanificacionData,
): Promise<void> {
  const r = await fetch(`${BASE}/backlog/${modulo}/${ticketId}/planificacion`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error guardando planificación' }))
    throw new Error(err.detail ?? 'Error guardando planificación')
  }
}

// ── Configuración PI ──────────────────────────────────────────────────────────

export async function getPis(): Promise<PiInfo[]> {
  const r = await fetch(`${BASE}/config/pis`)
  if (!r.ok) throw new Error('Error cargando PIs')
  return r.json()
}

export async function createPi(body: {
  nombre: string; fecha_inicio: string; fecha_fin: string
  dias_laborables: number; horas_por_dia: number; descripcion?: string
}): Promise<PiInfo> {
  const r = await authFetch(`${BASE}/config/pis`, {
    method: 'POST', body: JSON.stringify(body),
  })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
  return r.json()
}

export async function updatePi(piId: number, body: Partial<PiInfo>): Promise<PiInfo> {
  const r = await authFetch(`${BASE}/config/pis/${piId}`, {
    method: 'PUT', body: JSON.stringify(body),
  })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
  return r.json()
}

export async function deletePi(piId: number): Promise<{
  deleted: boolean
  deleted_counts: Record<string, number>
  replacement_pi: PiInfo | null
}> {
  const r = await authFetch(`${BASE}/config/pis/${piId}`, { method: 'DELETE' })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
  return r.json()
}

export async function activarPi(piId: number): Promise<PiInfo & { personas_copiadas: number; proyectos_copiados: number }> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/activar`, { method: 'POST' })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
  return r.json()
}

export async function getFestivos(piId: number): Promise<Festivo[]> {
  const r = await fetch(`${BASE}/config/pis/${piId}/festivos`)
  if (!r.ok) throw new Error('Error cargando festivos')
  return r.json()
}

export async function addFestivo(piId: number, fecha: string, nombre: string): Promise<Festivo> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/festivos`, {
    method: 'POST', body: JSON.stringify({ fecha, nombre }),
  })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
  return r.json()
}

export async function deleteFestivo(piId: number, festivoId: number): Promise<void> {
  const r = await authFetch(`${BASE}/config/pis/${piId}/festivos/${festivoId}`, { method: 'DELETE' })
  if (!r.ok) { const e = await r.json().catch(() => ({ detail: 'Error' })); throw new Error(e.detail) }
}

// ── Carga de archivos ─────────────────────────────────────────────────────────

export interface ExcelSheet {
  nombre: string
  columnas: string[]
  filas: string[][]
  total_filas: number
}

export interface ExcelPreview {
  filename: string
  hojas: ExcelSheet[]
  tiene_epic_link?: boolean
}

export interface BacklogTicket {
  ticket_key: string | null
  summary: string
  epic_link: string | null
  modulo: string
  issue_type: string | null
  status: string | null
  priority: string | null
  story_points: number | null
  assignee: string | null
  sprint: string | null
}

export interface BacklogAnalisis {
  total: number
  total_mc: number
  total_fabrica: number
  muestra_mc: BacklogTicket[]
  muestra_fabrica: BacklogTicket[]
  proyectos_detectados: string[]
}

export interface BacklogImportResult {
  insertados_mc: number
  insertados_fabrica: number
  duplicados_omitidos: number
  total_procesados: number
}

export interface IncidenteTicket {
  numero: string | null
  equipo: string | null
  fecha_escalado: string | null
  estado_sn: string | null
  jira: string | null
  comentario: string | null
  fecha_respuesta: string | null
  dias: number | null
}

export interface IncidentesAnalisis {
  total: number
  muestra: IncidenteTicket[]
}

export interface IncidentesImportResult {
  insertados: number
  duplicados_omitidos: number
  total_procesados: number
}

export async function analizarBacklog(file: File): Promise<BacklogAnalisis> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload/analizar-backlog`, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error analizando el archivo' }))
    throw new Error(err.detail ?? 'Error analizando el archivo')
  }
  return r.json()
}

export async function importarBacklog(file: File): Promise<BacklogImportResult> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload/importar-backlog`, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error importando el backlog' }))
    throw new Error(err.detail ?? 'Error importando el backlog')
  }
  return r.json()
}

export async function analizarIncidentes(file: File): Promise<IncidentesAnalisis> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload/analizar-incidentes`, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error analizando el archivo' }))
    throw new Error(err.detail ?? 'Error analizando el archivo')
  }
  return r.json()
}

export async function importarIncidentes(file: File): Promise<IncidentesImportResult> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload/importar-incidentes`, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error importando incidentes' }))
    throw new Error(err.detail ?? 'Error importando incidentes')
  }
  return r.json()
}

export async function previewExcel(file: File): Promise<ExcelPreview> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/upload/preview-excel`, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error procesando el archivo' }))
    throw new Error(err.detail ?? 'Error procesando el archivo')
  }
  return r.json()
}

// ── Estimación ────────────────────────────────────────────────────────────────

export async function extractFileText(file: File): Promise<{ text: string; meta: Record<string, unknown> }> {
  const form = new FormData()
  form.append('file', file)
  const r = await fetch(`${BASE}/estimation/extract-file`, { method: 'POST', body: form })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error extrayendo archivo' }))
    throw new Error(err.detail ?? 'Error extrayendo archivo')
  }
  return r.json()
}

export async function exportEstimacionWord(data: unknown): Promise<Blob> {
  const r = await fetch(`${BASE}/estimation/export-word`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error generando Word' }))
    throw new Error(err.detail ?? 'Error generando Word')
  }
  return r.blob()
}

export async function generarEstimacion(payload: {
  requerimiento: string
  fuente_adicional?: string
  incluir_contexto_pi?: boolean
}): Promise<EstimacionResult> {
  const r = await fetch(`${BASE}/estimation/estimar`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  if (!r.ok) {
    const err = await r.json().catch(() => ({ detail: 'Error generando estimación' }))
    throw new Error(err.detail ?? 'Error generando estimación')
  }
  return r.json()
}
