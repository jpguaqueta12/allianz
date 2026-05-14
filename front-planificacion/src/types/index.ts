export interface PersonaCapacidad {
  id: number
  nombre: string
  tecnologia: 'COBOL' | 'JAVA' | 'CALIDAD' | 'GESTION' | 'QA'
  rol: string
  proyecto_principal: string | null
  capacidad: number | null
  carga_estimada: number
  horas_disponibles: number | null
  estado: 'DISPONIBLE' | 'OCUPADO' | 'SOBRECARGADO' | 'LIDER TECNICO' | 'SIN CAPACIDAD'
}

export interface ResumenProyecto {
  id: number
  identi: string
  nombre: string
  modulo: string
  cap_java_horas: number
  cap_cobol_horas: number
  alerta: string | null
}

export interface Festivo {
  id: number
  fecha: string
  nombre: string
}

export interface PiInfo {
  id: number
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  dias_laborables: number
  horas_por_dia: number
  horas_por_persona: number
  activo: boolean
  estado: 'PLANIFICACION' | 'ACTIVO' | 'CERRADO'
  descripcion: string | null
  modulo?: string
  festivos?: Festivo[]
  festivos_count?: number
}

export interface PersonaDisponible {
  id: number
  nombre: string
  tecnologia: 'COBOL' | 'JAVA' | 'CALIDAD' | 'GESTION' | 'QA'
  rol: string
}

export interface BacklogItem {
  id: number
  created: string | null
  issue_type: string | null
  ticket_key: string | null
  project: string | null
  status: string | null
  include_release_notes: string | null
  resolution: string | null
  summary: string
  assigned_team: string | null
  assignee: string | null
  reporter: string | null
  epic_link: string | null
  priority: string | null
  story_points: number | null
  sprint: string | null
  labels: string | null
  components: string | null
  fix_version: string | null
  updated: string | null
  // planificación — responsable por tecnología
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
  planificacion_items?: {
    responsable: string | null
    perfil: 'java' | 'cobol' | 'gestion' | 'calidad'
    fase: 'desarrollo'
    horas: number | null
  }[]
  total_horas: number | null
  fecha_asignacion: string | null
  fecha_finalizacion: string | null
  fecha_finalizacion_inicial: string | null
  fecha_escalado: string | null
  fecha_reinicio: string | null
  fecha_entrega: string | null
  etc: number | null
  escalados: { fecha_escalado: string; fecha_reinicio: string | null }[]
  prn: string | null
}

export interface IncidenteItem {
  id: number
  numero: string | null
  equipo: string | null
  fecha_escalado: string | null
  estado_sn: string | null
  jira: string | null
  comentario: string | null
  fecha_respuesta: string | null
  dias: number | null
}

export interface AlertaItem {
  id: number
  ticket_key: string | null
  summary: string
  assignee: string | null
  equipo: string | null
  equipo_trabajo: string | null
  fecha_asignacion: string
  fecha_fin_desarrollo: string
  fecha_fin_qa: string | null
  alerta_desarrollo: 'verde' | 'amarilla' | 'roja'
  alerta_qa: 'verde' | 'amarilla' | 'roja' | null
  java_horas: number
  cobol_horas: number
  gestion_horas?: number
  calidad_horas?: number
  qa_horas: number
}

export interface DashboardData {
  capacidad: PersonaCapacidad[]
  resumen_proyectos: ResumenProyecto[]
  pi_activo: PiInfo | null
}

// ── Estimation ───────────────────────────────────────────────────────────────

export interface EstimationDriver {
  nombre: string
  cantidad: number
  horas_unitarias: number
  total_horas: number
  descripcion?: string
}

export interface EstimationCategory {
  drivers: EstimationDriver[]
  subtotal: number
}

export interface EstimationTotals {
  total_analisis: number
  total_construccion: number
  total_pruebas_tecnicas: number
  total_qa: number
  total_documentacion: number
  total_despliegue: number
  subtotal_sin_riesgo: number
}

export interface EstimationRisk {
  nivel: 'Bajo' | 'Medio' | 'Alto' | 'Crítico'
  porcentaje: number
  razones: string[]
  horas_riesgo: number
}

export interface EstimacionResult {
  titulo: string
  resumen_requerimiento: string
  categorias: {
    analisis: EstimationCategory
    java: EstimationCategory
    cobol: EstimationCategory
    apigee: EstimationCategory
    pruebas_tecnicas: EstimationCategory
    qa: EstimationCategory
    documentacion: EstimationCategory
    despliegue: EstimationCategory
  }
  totales: EstimationTotals
  nivel_complejidad: 'Baja' | 'Media' | 'Alta' | 'Crítica'
  factor_riesgo: EstimationRisk
  total_final: number
  perfiles: { perfil: string; horas: number }[]
  supuestos: string[]
  observaciones: string[]
}

export type SSEEventType = 'token' | 'tool_start' | 'tool_end' | 'complete' | 'error'

export interface SSEEvent {
  type: SSEEventType
  content?: string
  tool?: string
  input?: Record<string, unknown>
  output?: string
  full_response?: string
  message?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
  tool_calls?: { tool: string; input: Record<string, unknown>; output: string }[]
  timestamp: Date
}
