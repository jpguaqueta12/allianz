import { useEffect, useRef, useState } from 'react'
import {
  Loader2, AlertCircle, RefreshCw, ClipboardEdit,
  X, Save, CheckCircle2, Trash2, Plus, Eye, CalendarDays,
} from 'lucide-react'
import clsx from 'clsx'
import { BacklogItem, PiInfo } from '../../types'
import {
  getBacklog, createBacklogItem, deleteBacklogItem, updatePlanificacion, updateFechaAsignacion, updateEscalamiento, updateBacklogStatus, getResponsables,
  CreateBacklogData, PlanificacionData, PlanificacionItem, ResponsableDisponible,
} from '../../services/api'

// ── Cálculo fecha finalización ────────────────────────────────────────────────

function addWorkingDays(startIso: string, days: number, festivosSet: Set<string>, horasPorDia: number): string {
  const d = new Date(startIso + 'T12:00:00')
  let added = 0
  while (added < days) {
    d.setDate(d.getDate() + 1)
    const dow = d.getDay()
    const iso = d.toISOString().split('T')[0]
    if (dow !== 0 && dow !== 6 && !festivosSet.has(iso)) added++
  }
  return d.toISOString().split('T')[0]
}

function calendarDaysBetween(startIso: string | null, endIso: string | null): number {
  if (!startIso || !endIso) return 0
  const start = new Date(startIso + 'T12:00:00')
  const end = new Date(endIso + 'T12:00:00')
  if (end <= start) return 0
  return Math.round((end.getTime() - start.getTime()) / 86400000)
}

function addCalendarDays(startIso: string, days: number): string {
  const d = new Date(startIso + 'T12:00:00')
  d.setDate(d.getDate() + Math.max(days, 0))
  return d.toISOString().split('T')[0]
}

function calcularFechaFin(item: BacklogItem, piActivo?: PiInfo | null): string | null {
  if (!item.fecha_asignacion) return null

  let java = 0, cobol = 0, calidad = 0

  if (item.planificacion_items?.length) {
    for (const p of item.planificacion_items) {
      const h = p.horas ?? 0
      if (p.perfil === 'java')       java  += h
      else if (p.perfil === 'cobol') cobol += h
      else if (p.perfil === 'calidad') calidad += h
    }
  } else {
    java  = (item.horas_analisis_java  ?? 0) + (item.horas_desarrollo_java  ?? 0)
          + (item.horas_pruebas_java   ?? 0) + (item.horas_af_java          ?? 0)
    cobol = (item.horas_analisis_cobol ?? 0) + (item.horas_desarrollo_cobol ?? 0)
          + (item.horas_pruebas_cobol  ?? 0) + (item.horas_af_cobol         ?? 0)
    calidad = (item.horas_analisis_qa ?? 0) + (item.horas_af_qa ?? 0)
  }

  const totalHoras = Math.max(java, cobol) + calidad
  if (totalHoras <= 0) return null

  const horasPorDia   = piActivo?.horas_por_dia ?? 8
  const festivosSet   = new Set((piActivo?.festivos ?? []).map(f => f.fecha))
  const diasLaborables = Math.ceil(totalHoras * 1.15 / horasPorDia)

  const base = addWorkingDays(item.fecha_asignacion, diasLaborables, festivosSet, horasPorDia)
  if (item.fecha_escalado && !item.fecha_reinicio) return null  // escalated, no restart yet
  if (item.fecha_escalado && item.fecha_reinicio) {
    const etc = item.etc ?? calendarDaysBetween(item.fecha_escalado, base)
    return addCalendarDays(item.fecha_reinicio, etc)
  }

  return base
}

function calcularEtc(item: BacklogItem, piActivo?: PiInfo | null): number {
  if (!item.fecha_escalado) return 0
  if (item.etc != null && item.etc > 0) return item.etc
  return calendarDaysBetween(item.fecha_escalado, calcularFechaFin(item, piActivo))
}

// ── colores badges ─────────────────────────────────────────────────────────────

const PRIORITY_COLOR: Record<string, string> = {
  Highest: 'text-red-700 bg-red-50 border-red-200',
  High:    'text-orange-700 bg-orange-50 border-orange-200',
  Medium:  'text-amber-700 bg-amber-50 border-amber-200',
  Low:     'text-blue-700 bg-blue-50 border-blue-200',
  Lowest:  'text-gray-500 bg-gray-50 border-gray-200',
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]
const STATUS_OPTIONS = [
  'Backlog',
  'To Do',
  'In Analysis',
  'In Progress',
  'In Acceptance',
  'WAITING FOR APPROVAL',
  'Escalado',
  'Finalizado',
]

function Badge({ value, colorMap }: { value: string | null; colorMap: Record<string, string> }) {
  if (!value) return <span className="text-corporate-muted text-xs">—</span>
  const cls = colorMap[value] ?? 'text-corporate-muted bg-corporate-surface border-corporate-line'
  return (
    <span className={clsx('inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-normal break-words', cls)}>
      {value}
    </span>
  )
}

function PaginationControls({
  page,
  pageCount,
  pageSize,
  total,
  start,
  end,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  start: number
  end: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-corporate-line bg-white px-3 py-2">
      <span className="text-xs text-corporate-muted">
        {total > 0 ? `${start}-${end} de ${total}` : '0 resultados'}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-corporate-line bg-white px-2 py-1 text-xs text-corporate-ink"
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size} por página</option>
          ))}
        </select>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded border border-corporate-line px-2.5 py-1 text-xs text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="min-w-[70px] text-center text-xs font-medium text-corporate-ink">
          {page}/{pageCount}
        </span>
        <button
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="rounded border border-corporate-line px-2.5 py-1 text-xs text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}

// ── constantes planificación ───────────────────────────────────────────────────

type Tech = 'java' | 'cobol' | 'gestion' | 'calidad'
type Fase = 'desarrollo'

const TECHS: { id: Tech; label: string; color: string; headerBg: string; techMatch: 'JAVA' | 'COBOL' | 'GESTION' | 'CALIDAD' }[] = [
  { id: 'java',       label: 'JAVA',       color: 'text-blue-700',   headerBg: 'bg-blue-600',   techMatch: 'JAVA'  },
  { id: 'cobol',      label: 'COBOL',      color: 'text-emerald-700',headerBg: 'bg-emerald-600',techMatch: 'COBOL' },
  { id: 'gestion',    label: 'GESTIÓN',    color: 'text-amber-700',  headerBg: 'bg-amber-500',  techMatch: 'GESTION' },
  { id: 'calidad',    label: 'CALIDAD',    color: 'text-rose-700',   headerBg: 'bg-rose-500',   techMatch: 'CALIDAD' },
]

const FASES: { id: Fase; label: string; techs: Tech[] }[] = [
  { id: 'desarrollo', label: 'DESARROLLO', techs: ['java','cobol','gestion','calidad'] },
]

function horaField(fase: Fase, tech: Tech): keyof PlanificacionData {
  return `horas_${fase}_${tech}` as keyof PlanificacionData
}
function respField(tech: Tech): keyof PlanificacionData {
  return `responsable_${tech}` as keyof PlanificacionData
}

function legacyRespField(tech: Tech): keyof PlanificacionData | null {
  if (tech === 'java' || tech === 'cobol') return respField(tech)
  if (tech === 'calidad') return 'responsable_qa'
  return null
}

function normalizePerfil(perfil: string): Tech {
  if (perfil === 'qa') return 'calidad'
  if (perfil === 'dialogue' || perfil === 'parametria') return 'gestion'
  if (perfil === 'cobol' || perfil === 'gestion' || perfil === 'calidad') return perfil
  return 'java'
}

const RESPONSABLE_SEPARATOR = ' | '
type PlanificacionRow = PlanificacionItem & { id: string }

function splitResponsables(value: string | null): string[] {
  if (!value) return []
  return value
    .split(/\s*(?:\||;|,)\s*/)
    .map(v => v.trim())
    .filter(Boolean)
}

function joinResponsables(values: string[]): string | null {
  const unique = Array.from(new Set(values.map(v => v.trim()).filter(Boolean)))
  return unique.length ? unique.join(RESPONSABLE_SEPARATOR) : null
}

const PLAN_VACÍO: PlanificacionData = {
  responsable_java: null, responsable_cobol: null,
  responsable_dialogue: null, responsable_parametria: null, responsable_qa: null,
  horas_analisis_java: null, horas_analisis_cobol: null,
  horas_analisis_dialogue: null, horas_analisis_parametria: null, horas_analisis_qa: null,
  horas_desarrollo_java: null, horas_desarrollo_cobol: null,
  horas_desarrollo_dialogue: null, horas_desarrollo_parametria: null,
  horas_pruebas_java: null, horas_pruebas_cobol: null,
  horas_pruebas_dialogue: null, horas_pruebas_parametria: null,
  horas_af_java: null, horas_af_cobol: null,
  horas_af_dialogue: null, horas_af_parametria: null, horas_af_qa: null,
  planificacion_items: [],
  fecha_asignacion: null,
}

function itemToPlan(item: BacklogItem): PlanificacionData {
  return {
    responsable_java: item.responsable_java, responsable_cobol: item.responsable_cobol,
    responsable_dialogue: item.responsable_dialogue, responsable_parametria: item.responsable_parametria,
    responsable_qa: item.responsable_qa,
    horas_analisis_java: item.horas_analisis_java, horas_analisis_cobol: item.horas_analisis_cobol,
    horas_analisis_dialogue: item.horas_analisis_dialogue, horas_analisis_parametria: item.horas_analisis_parametria,
    horas_analisis_qa: item.horas_analisis_qa,
    horas_desarrollo_java: item.horas_desarrollo_java, horas_desarrollo_cobol: item.horas_desarrollo_cobol,
    horas_desarrollo_dialogue: item.horas_desarrollo_dialogue, horas_desarrollo_parametria: item.horas_desarrollo_parametria,
    horas_pruebas_java: item.horas_pruebas_java, horas_pruebas_cobol: item.horas_pruebas_cobol,
    horas_pruebas_dialogue: item.horas_pruebas_dialogue, horas_pruebas_parametria: item.horas_pruebas_parametria,
    horas_af_java: item.horas_af_java, horas_af_cobol: item.horas_af_cobol,
    horas_af_dialogue: item.horas_af_dialogue, horas_af_parametria: item.horas_af_parametria,
    horas_af_qa: item.horas_af_qa,
    planificacion_items: item.planificacion_items ?? [],
  }
}

function newRow(): PlanificacionRow {
  return { id: crypto.randomUUID(), responsable: null, perfil: 'java', fase: 'desarrollo', horas: null }
}

function legacyRowsFromPlan(plan: PlanificacionData): PlanificacionRow[] {
  const rows: PlanificacionRow[] = []
  TECHS.forEach(tech => {
    const respKey = legacyRespField(tech.id)
    const responsables = respKey ? splitResponsables(plan[respKey] as string | null) : []
    const horas = tech.id === 'calidad'
      ? (plan.horas_analisis_qa ?? 0) + (plan.horas_af_qa ?? 0)
      : tech.id === 'gestion'
      ? (plan.horas_analisis_dialogue ?? 0) + (plan.horas_desarrollo_dialogue ?? 0) + (plan.horas_pruebas_dialogue ?? 0) + (plan.horas_af_dialogue ?? 0)
        + (plan.horas_analisis_parametria ?? 0) + (plan.horas_desarrollo_parametria ?? 0) + (plan.horas_pruebas_parametria ?? 0) + (plan.horas_af_parametria ?? 0)
      : (['analisis', 'desarrollo', 'pruebas', 'af'] as const)
        .reduce((sum, fase) => sum + (((plan[`horas_${fase}_${tech.id}` as keyof PlanificacionData] as number | null) ?? 0)), 0)
    if (horas <= 0) return
    if (responsables.length === 0) {
      rows.push({ id: crypto.randomUUID(), responsable: null, perfil: tech.id, fase: 'desarrollo', horas })
      return
    }
    const horasPorResponsable = horas / responsables.length
    responsables.forEach(responsable => {
      rows.push({ id: crypto.randomUUID(), responsable, perfil: tech.id, fase: 'desarrollo', horas: horasPorResponsable })
    })
  })
  return rows
}

function itemToRows(item: BacklogItem): PlanificacionRow[] {
  const stored = item.planificacion_items ?? []
  if (stored.length) {
    return stored.map(row => ({ ...row, perfil: normalizePerfil(row.perfil), fase: 'desarrollo' as const, id: crypto.randomUUID() }))
  }
  const legacy = legacyRowsFromPlan(itemToPlan(item))
  return legacy.length ? legacy : [newRow()]
}

function rowsToPlan(rows: PlanificacionRow[]): PlanificacionData {
  const data: PlanificacionData = { ...PLAN_VACÍO, planificacion_items: [] }
  const responsablesPorPerfil: Record<Tech, string[]> = {
    java: [], cobol: [], gestion: [], calidad: [],
  }

  rows.forEach(row => {
    const horas = row.horas ?? 0
    if (horas <= 0) return
    const key = horaField(row.fase, row.perfil)
    if (key in data) {
      data[key] = (((data[key] as number | null) ?? 0) + horas) as never
    }
    if (row.responsable && !responsablesPorPerfil[row.perfil].includes(row.responsable)) {
      responsablesPorPerfil[row.perfil].push(row.responsable)
    }
    data.planificacion_items?.push({
      responsable: row.responsable,
      perfil: row.perfil,
      fase: 'desarrollo',
      horas,
    })
  })

  TECHS.forEach(tech => {
    const respKey = legacyRespField(tech.id)
    if (respKey) data[respKey] = joinResponsables(responsablesPorPerfil[tech.id]) as never
  })

  return data
}

function responsablesForPerfil(personas: ResponsableDisponible[], perfil: Tech) {
  const tech = TECHS.find(t => t.id === perfil)
  return personas.filter(p => {
    if (tech?.techMatch === 'CALIDAD') return p.tecnologia === 'CALIDAD' || p.tecnologia === 'QA'
    return p.tecnologia === tech?.techMatch
  })
}

function responsablesByPerfil(item: BacklogItem): { t: typeof TECHS[number]; responsables: string[] }[] {
  if (item.planificacion_items?.length) {
    return TECHS
      .map(t => {
        const responsables = item.planificacion_items!
          .filter(row => row.perfil === t.id && row.responsable)
          .map(row => row.responsable!)
        return { t, responsables: Array.from(new Set(responsables)) }
      })
      .filter(x => x.responsables.length > 0)
  }

  return TECHS
    .map(t => {
      const respKey = legacyRespField(t.id)
      return { t, responsables: respKey ? splitResponsables(item[respKey] as string | null) : [] }
    })
    .filter(x => x.responsables.length > 0)
}

// ── Modal planificación ────────────────────────────────────────────────────────

interface ModalProps {
  item: BacklogItem
  modulo: string
  onClose: () => void
  onSaved: (updated: PlanificacionData) => void
  onCapacityRefresh?: () => void | Promise<void>
  piId?: number | null
}

function PlanificacionModal({ item, modulo, onClose, onSaved, onCapacityRefresh, piId }: ModalProps) {
  const [rows, setRows]                   = useState<PlanificacionRow[]>(itemToRows(item))
  const [personas, setPersonas]           = useState<ResponsableDisponible[]>([])
  const [saving, setSaving]               = useState(false)
  const [saved, setSaved]                 = useState(false)
  const [confirm, setConfirm]             = useState(false)
  const [error, setError]                 = useState<string | null>(null)
  const [fechaAsignacion, setFechaAsignacion] = useState<string | null>(item.fecha_asignacion ?? null)

  useEffect(() => {
    getResponsables(modulo, piId).then(setPersonas).catch(() => {})
  }, [modulo, piId])

  function updateRow(id: string, patch: Partial<PlanificacionRow>) {
    setRows(prev => prev.map(row => {
      if (row.id !== id) return row
      const next = { ...row, ...patch }
      const patchedPerfil = patch.perfil as Tech | undefined
      if (patchedPerfil && !FASES.some(f => f.id === next.fase && f.techs.includes(patchedPerfil))) {
        next.fase = FASES.find(f => f.techs.includes(patchedPerfil))?.id ?? 'desarrollo'
      }
      return next
    }))
  }

  function setHoras(id: string, raw: string) {
    const n = raw === '' ? null : parseFloat(raw.replace(',', '.'))
    updateRow(id, { horas: isNaN(n as number) ? null : n })
  }

  function removeRow(id: string) {
    setRows(prev => prev.length > 1 ? prev.filter(row => row.id !== id) : [newRow()])
  }

  const totalGeneral = rows.reduce((sum, row) => sum + ((row.horas ?? 0) > 0 ? row.horas ?? 0 : 0), 0)

  async function handleSave(data: PlanificacionData) {
    setSaving(true); setError(null); setConfirm(false)
    try {
      await updatePlanificacion(modulo, item.id, data)
      try {
        await onCapacityRefresh?.()
      } catch {
        // La planificación ya quedó guardada; el refresco periódico corregirá la capacidad si falla aquí.
      }
      setSaved(true)
      setTimeout(() => { onSaved(data); onClose() }, 700)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  function saveRows() {
    const activeRows = rows.filter(row => row.responsable || (row.horas ?? 0) > 0)
    const incomplete = activeRows.some(row => !row.responsable || !row.horas || row.horas <= 0)
    if (incomplete) {
      setError('Cada asignación debe tener responsable y horas mayores a 0')
      return
    }
    handleSave({ ...rowsToPlan(activeRows), fecha_asignacion: fechaAsignacion })
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="w-full max-w-4xl rounded-2xl bg-white shadow-2xl flex flex-col max-h-[92vh]">

        {/* header */}
        <div className="flex items-start justify-between gap-4 rounded-t-2xl bg-gradient-to-r from-allianz-blue to-blue-700 px-6 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-blue-200">{item.ticket_key ?? '—'}</p>
            <p className="mt-0.5 text-sm font-semibold text-white line-clamp-2" title={item.summary}>{item.summary}</p>
          </div>
          <button onClick={onClose} className="shrink-0 rounded-lg p-1.5 hover:bg-white/20 transition-colors">
            <X size={16} className="text-white" />
          </button>
        </div>

        {/* fecha asignación */}
        <div className="border-b border-corporate-line bg-blue-50/60 px-6 py-3">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-allianz-blue">
            Fecha de asignación de inicio
          </p>
          <div className="flex items-center gap-3">
            <CalendarDays size={15} className="shrink-0 text-allianz-blue" />
            <input
              type="date"
              value={fechaAsignacion ?? ''}
              onChange={e => setFechaAsignacion(e.target.value || null)}
              className="rounded-lg border border-allianz-blue/40 bg-white px-3 py-1.5 text-sm text-corporate-ink shadow-sm focus:outline-none focus:ring-2 focus:ring-allianz-blue"
            />
            {fechaAsignacion ? (
              <button
                type="button"
                onClick={() => setFechaAsignacion(null)}
                className="flex items-center gap-1 rounded px-2 py-1 text-xs text-red-500 hover:bg-red-50 transition-colors"
              >
                <X size={12} /> Quitar fecha
              </button>
            ) : (
              <span className="text-xs text-corporate-muted">Sin fecha asignada</span>
            )}
          </div>
        </div>

        {/* confirm borrar */}
        {confirm && (
          <div className="mx-6 mt-4 flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
            <AlertCircle size={15} className="shrink-0 text-red-600" />
            <span className="flex-1 text-xs font-medium text-red-700">¿Borrar toda la planificación de este ticket?</span>
            <button onClick={() => handleSave(PLAN_VACÍO)}
              className="rounded bg-red-600 px-3 py-1 text-xs font-semibold text-white hover:bg-red-700">
              Confirmar
            </button>
            <button onClick={() => setConfirm(false)}
              className="rounded border border-red-200 px-3 py-1 text-xs font-medium text-red-600 hover:bg-red-100">
              Cancelar
            </button>
          </div>
        )}

        <div className="overflow-y-auto px-6 py-5">
          <div className="rounded-xl border border-corporate-line shadow-sm">
            <div className="flex items-center justify-between gap-3 border-b border-corporate-line bg-slate-50 px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-corporate-ink">Asignaciones</p>
                <p className="text-[11px] text-corporate-muted">Responsable, perfil y horas de desarrollo por cada parte de la tarea.</p>
              </div>
              <button
                type="button"
                onClick={() => setRows(prev => [...prev, newRow()])}
                className="inline-flex items-center gap-1.5 rounded-md bg-allianz-blue px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
              >
                <Plus size={13} /> Agregar
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-800 text-white">
                    <th className="px-3 py-2.5 text-left font-semibold">Responsable</th>
                    <th className="px-3 py-2.5 text-left font-semibold">Perfil</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Horas</th>
                    <th className="w-10 px-2 py-2.5" />
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, idx) => {
                    const responsables = responsablesForPerfil(personas, row.perfil)
                    return (
                      <tr key={row.id} className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/70'}>
                        <td className="border-b border-corporate-line px-3 py-2">
                          <select
                            value={row.responsable ?? ''}
                            onChange={e => updateRow(row.id, { responsable: e.target.value || null })}
                            className="w-full rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue"
                          >
                            <option value="">Seleccionar responsable</option>
                            {responsables.map(p => (
                              <option key={p.id} value={p.nombre} disabled={p.al_tope && p.nombre !== row.responsable}>
                                {p.nombre}{p.al_tope ? ' - al tope' : ` (${p.horas_restantes}h disp.)`}
                              </option>
                            ))}
                          </select>
                        </td>
                        <td className="border-b border-corporate-line px-3 py-2">
                          <select
                            value={row.perfil}
                            onChange={e => updateRow(row.id, { perfil: e.target.value as Tech, responsable: null })}
                            className="w-full rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue"
                          >
                            {TECHS.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
                          </select>
                        </td>
                        <td className="border-b border-corporate-line px-3 py-2">
                          <input
                            type="number"
                            min="0"
                            step="0.5"
                            value={row.horas ?? ''}
                            onChange={e => setHoras(row.id, e.target.value)}
                            className="ml-auto block w-28 rounded border border-corporate-line bg-white px-2 py-1.5 text-right text-xs font-medium text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue"
                          />
                        </td>
                        <td className="border-b border-corporate-line px-2 py-2 text-center">
                          <button
                            type="button"
                            onClick={() => removeRow(row.id)}
                            className="rounded p-1 text-corporate-muted hover:bg-red-50 hover:text-red-600"
                            title="Quitar asignación"
                          >
                            <Trash2 size={13} />
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
                <tfoot>
                  <tr className="bg-slate-800 text-white">
                    <td colSpan={2} className="px-3 py-2.5 text-right text-xs font-bold">TOTAL</td>
                    <td className="px-3 py-2.5 text-right text-sm font-bold">
                      {totalGeneral > 0 ? totalGeneral : <span className="text-slate-500 font-normal text-xs">—</span>}
                    </td>
                    <td />
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {error && (
            <div className="mt-3 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              <AlertCircle size={13} /> {error}
            </div>
          )}
        </div>

        {/* footer */}
        <div className="flex items-center justify-between gap-3 rounded-b-2xl border-t border-corporate-line bg-corporate-surface px-6 py-4">
          <button
            onClick={() => setConfirm(true)}
            disabled={saving}
            className="flex items-center gap-1.5 rounded-lg border border-red-200 px-3 py-2 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
          >
            <Trash2 size={13} /> Borrar plan
          </button>
          <div className="flex items-center gap-3">
            <button onClick={onClose} disabled={saving}
              className="rounded-lg border border-corporate-line px-4 py-2 text-sm font-medium text-corporate-muted hover:text-corporate-ink disabled:opacity-40">
              Cancelar
            </button>
            <button onClick={saveRows} disabled={saving || saved}
              className="flex items-center gap-2 rounded-lg bg-allianz-blue px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition-colors">
              {saved
                ? <><CheckCircle2 size={15} /> Guardado</>
                : saving
                ? <><Loader2 size={15} className="animate-spin" /> Guardando…</>
                : <><Save size={15} /> Guardar planificación</>
              }
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Chips responsables en tabla ────────────────────────────────────────────────

function ResponsablesCell({ item }: { item: BacklogItem }) {
  const asignados = responsablesByPerfil(item)
  if (asignados.length === 0) return <span className="text-corporate-muted text-xs">—</span>
  return (
    <div className="flex flex-wrap gap-1">
      {asignados.map(({ t, responsables }) => (
        <span key={t.id} className={clsx('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium',
          t.id === 'java'       ? 'border-blue-200 bg-blue-50 text-blue-700'    :
          t.id === 'cobol'      ? 'border-emerald-200 bg-emerald-50 text-emerald-700' :
          t.id === 'gestion'    ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                  'border-rose-200 bg-rose-50 text-rose-700'
        )}>
          <span className="font-bold">{t.label}</span>
          <span className="opacity-75 max-w-[90px] truncate" title={responsables.join(', ')}>
            {responsables.map(r => r.split(' ')[0]).join(' + ')}
          </span>
        </span>
      ))}
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase text-corporate-muted">{label}</p>
      <div className="mt-1 min-h-[24px] rounded border border-corporate-line bg-corporate-surface px-2 py-1.5 text-xs text-corporate-ink break-words">
        {value || <span className="text-corporate-muted">—</span>}
      </div>
    </div>
  )
}

function StatusSelectField({
  item,
  modulo,
  statusOptions,
  onSaved,
}: {
  item: BacklogItem
  modulo: string
  statusOptions: string[]
  onSaved: (patch: Partial<BacklogItem>) => void
}) {
  const [value, setValue] = useState(item.status ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const options = Array.from(new Set([...statusOptions, item.status].filter(Boolean) as string[]))

  useEffect(() => {
    setValue(item.status ?? '')
  }, [item.status])

  async function handleChange(nextStatus: string) {
    const previous = item.status ?? ''
    setValue(nextStatus)
    setSaving(true)
    setError(null)
    try {
      const res = await updateBacklogStatus(modulo, item.id, nextStatus)
      onSaved({ status: res.status, fecha_entrega: res.fecha_entrega })
    } catch (e: unknown) {
      setValue(previous)
      setError(e instanceof Error ? e.message : 'Error guardando status')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase text-corporate-muted">Status</p>
      <div className="mt-1 min-h-[24px] rounded border border-corporate-line bg-corporate-surface px-2 py-1.5 text-xs text-corporate-ink">
        <div className="flex items-center gap-2">
          <select
            value={value}
            onChange={e => handleChange(e.target.value)}
            disabled={saving}
            className="min-w-0 flex-1 rounded border border-corporate-line bg-white px-2 py-1 text-xs text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue disabled:opacity-50"
          >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          {saving && <Loader2 size={13} className="shrink-0 animate-spin text-allianz-blue" />}
        </div>
        {error && <p className="mt-1 text-[11px] text-red-600">{error}</p>}
      </div>
    </div>
  )
}

function BacklogDetailModal({
  item,
  modulo,
  onClose,
  onSaved,
  piActivo,
  statusOptions,
}: {
  item: BacklogItem
  modulo: string
  onClose: () => void
  onSaved: (patch: Partial<BacklogItem>) => void
  piActivo?: PiInfo | null
  statusOptions: string[]
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-corporate-line bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-corporate-line px-5 py-4">
          <div className="min-w-0">
            <p className="font-mono text-xs font-semibold text-allianz-blue">{item.ticket_key ?? '—'}</p>
            <p className="mt-1 text-sm font-semibold text-corporate-ink break-words" title={item.summary}>{item.summary}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-corporate-muted hover:bg-corporate-surface hover:text-corporate-ink">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-3">
            <DetailField label="Created" value={item.created} />
            <DetailField label="Tipo" value={<Badge value={item.issue_type} colorMap={{}} />} />
            <StatusSelectField item={item} modulo={modulo} statusOptions={statusOptions} onSaved={onSaved} />
            <DetailField label="Fecha Asignación" value={item.fecha_asignacion ?? null} />
            <DetailField label="Fecha Finalización" value={item.fecha_finalizacion ?? calcularFechaFin(item, piActivo)} />
            <DetailField label="Fecha Entrega" value={item.fecha_entrega ?? null} />
            <DetailField label="Fecha Escalado" value={item.fecha_escalado ?? null} />
            <DetailField label="Fecha Reinicio" value={item.fecha_reinicio ?? null} />
            <DetailField label="ETC" value={`${calcularEtc(item, piActivo)} días`} />
            <DetailField label="Resolution" value={item.resolution} />
            <DetailField label="Assignee" value={item.assignee} />
            <DetailField label="Reporter" value={item.reporter} />
            <DetailField label="Epic Link" value={item.epic_link} />
            <DetailField label="Priority" value={<Badge value={item.priority} colorMap={PRIORITY_COLOR} />} />
            <DetailField label="Story Points" value={item.story_points ?? null} />
            <DetailField label="Sprint" value={item.sprint} />
            <DetailField label="Components" value={item.components} />
            <DetailField label="Fix Version" value={item.fix_version} />
            <DetailField label="Updated" value={item.updated} />
            <DetailField label="Project" value={item.project} />
            <DetailField label="Assigned Team" value={item.assigned_team} />
          </div>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <DetailField label="Labels" value={item.labels} />
            <DetailField label="Release Notes" value={item.include_release_notes} />
          </div>
          <div className="mt-3">
            <DetailField label="Equipo planificado" value={<ResponsablesCell item={item} />} />
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Celda fecha asignación ────────────────────────────────────────────────────

function FechaAsignacionCell({
  item,
  modulo,
  onSaved,
}: {
  item: BacklogItem
  modulo: string
  onSaved: (fecha: string | null, fechaFinalizacion: string | null) => void
}) {
  const [saving, setSaving] = useState(false)
  const [value, setValue]   = useState(item.fecha_asignacion ?? '')
  const valueRef  = useRef(item.fecha_asignacion ?? '')
  const savingRef = useRef(false)   // evita que useEffect pise el valor durante la llamada al API

  useEffect(() => {
    if (savingRef.current) return   // guardado en vuelo: no resetear lo que el usuario escribió
    const v = item.fecha_asignacion ?? ''
    setValue(v)
    valueRef.current = v
  }, [item.fecha_asignacion])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setValue(e.target.value)
    valueRef.current = e.target.value
  }

  function commit() {
    const trimmed = valueRef.current.trim()
    const current = item.fecha_asignacion ?? ''
    if (trimmed === current) return

    if (!trimmed) {
      savingRef.current = true
      setSaving(true)
      updateFechaAsignacion(modulo, item.id, null)
        .then(res => onSaved(null, res.fecha_finalizacion))
        .catch(() => { setValue(current); valueRef.current = current })
        .finally(() => { savingRef.current = false; setSaving(false) })
      return
    }

    if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || isNaN(Date.parse(trimmed))) {
      setValue(current)
      valueRef.current = current
      return
    }

    savingRef.current = true
    setSaving(true)
    updateFechaAsignacion(modulo, item.id, trimmed)
      .then(res => onSaved(trimmed, res.fecha_finalizacion))
      .catch(() => { setValue(current); valueRef.current = current })
      .finally(() => { savingRef.current = false; setSaving(false) })
  }

  return (
    <div className="flex items-center gap-1 px-1">
      <CalendarDays size={12} className={clsx('shrink-0', value ? 'text-allianz-blue' : 'text-corporate-muted')} />
      <input
        type="text"
        value={value}
        placeholder="AAAA-MM-DD"
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        disabled={saving}
        className="w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-corporate-ink placeholder-corporate-muted focus:border-allianz-blue focus:bg-white focus:outline-none disabled:opacity-50"
      />
      {saving && <Loader2 size={12} className="animate-spin text-allianz-blue shrink-0" />}
    </div>
  )
}

type EscalamientoPatch = {
  fecha_escalado: string | null
  fecha_reinicio: string | null
  fecha_finalizacion: string | null
  etc: number
  status: string | null
}

function EscalamientoDateCell({
  item,
  modulo,
  field,
  onSaved,
}: {
  item: BacklogItem
  modulo: string
  field: 'fecha_escalado' | 'fecha_reinicio'
  onSaved: (updated: EscalamientoPatch) => void
}) {
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(false)
  const [value, setValue] = useState(item[field] ?? '')
  const valueRef = useRef(item[field] ?? '')
  const savingRef = useRef(false)

  useEffect(() => {
    if (savingRef.current) return
    const v = item[field] ?? ''
    setValue(v)
    valueRef.current = v
  }, [field, item])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setError(false)
    setValue(e.target.value)
    valueRef.current = e.target.value
  }

  function commit() {
    const trimmed = valueRef.current.trim()
    const current = item[field] ?? ''
    if (trimmed === current) return

    if (trimmed && (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed) || isNaN(Date.parse(trimmed)))) {
      setValue(current)
      valueRef.current = current
      setError(true)
      return
    }

    const fechaEscalado = field === 'fecha_escalado' ? (trimmed || null) : item.fecha_escalado
    const fechaReinicio = field === 'fecha_reinicio' ? (trimmed || null) : item.fecha_reinicio

    savingRef.current = true
    setSaving(true)
    updateEscalamiento(modulo, item.id, {
      fecha_escalado: fechaEscalado,
      fecha_reinicio: fechaEscalado ? fechaReinicio : null,
    })
      .then(res => {
        onSaved({
          fecha_escalado: res.fecha_escalado,
          fecha_reinicio: res.fecha_reinicio,
          fecha_finalizacion: res.fecha_finalizacion,
          etc: res.etc,
          status: res.status,
        })
      })
      .catch(() => {
        setValue(current)
        valueRef.current = current
        setError(true)
      })
      .finally(() => {
        savingRef.current = false
        setSaving(false)
      })
  }

  return (
    <div className="flex items-center gap-1 px-1">
      <CalendarDays size={12} className={clsx('shrink-0', value ? 'text-orange-600' : 'text-corporate-muted')} />
      <input
        type="text"
        value={value}
        placeholder="AAAA-MM-DD"
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        disabled={saving || (field === 'fecha_reinicio' && !item.fecha_escalado)}
        className={clsx(
          'w-24 rounded border bg-transparent px-1 py-0.5 text-xs text-corporate-ink placeholder-corporate-muted focus:bg-white focus:outline-none disabled:opacity-50',
          error ? 'border-red-300 focus:border-red-500' : 'border-transparent focus:border-allianz-blue',
        )}
      />
      {saving && <Loader2 size={12} className="animate-spin text-allianz-blue shrink-0" />}
    </div>
  )
}

const BACKLOG_FORM_EMPTY: CreateBacklogData = {
  ticket_key: null,
  summary: '',
  issue_type: null,
  project: null,
  status: 'Backlog',
  assigned_team: null,
  assignee: null,
  reporter: null,
  epic_link: null,
  priority: null,
  story_points: null,
  sprint: null,
  labels: null,
  components: null,
  fix_version: null,
}

function textOrNull(value: string): string | null {
  const trimmed = value.trim()
  return trimmed ? trimmed : null
}

function ManualBacklogModal({
  modulo,
  piId,
  onClose,
  onCreated,
}: {
  modulo: string
  piId?: number | null
  onClose: () => void
  onCreated: (item: BacklogItem) => void
}) {
  const [form, setForm] = useState<CreateBacklogData>(BACKLOG_FORM_EMPTY)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function setField<K extends keyof CreateBacklogData>(field: K, value: CreateBacklogData[K]) {
    setForm(prev => ({ ...prev, [field]: value }))
  }

  async function handleSubmit() {
    if (!form.summary.trim()) {
      setError('El summary es obligatorio')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createBacklogItem(modulo, piId, {
        ...form,
        ticket_key: textOrNull(form.ticket_key ?? ''),
        summary: form.summary.trim(),
        issue_type: textOrNull(form.issue_type ?? ''),
        project: textOrNull(form.project ?? ''),
        status: textOrNull(form.status ?? '') ?? 'Backlog',
        assigned_team: textOrNull(form.assigned_team ?? ''),
        assignee: textOrNull(form.assignee ?? ''),
        reporter: textOrNull(form.reporter ?? ''),
        epic_link: textOrNull(form.epic_link ?? ''),
        priority: textOrNull(form.priority ?? ''),
        sprint: textOrNull(form.sprint ?? ''),
        labels: textOrNull(form.labels ?? ''),
        components: textOrNull(form.components ?? ''),
        fix_version: textOrNull(form.fix_version ?? ''),
      })
      onCreated(created)
      onClose()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando ticket')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-3xl rounded-xl border border-corporate-line bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-corporate-line px-5 py-4">
          <div>
            <p className="text-sm font-semibold text-corporate-ink">Nuevo elemento de backlog</p>
            <p className="mt-0.5 text-xs text-corporate-muted">{modulo === 'FABRICA' ? 'Fábrica' : 'Mejora Continua'}</p>
          </div>
          <button onClick={onClose} disabled={saving} className="rounded p-1.5 text-corporate-muted hover:bg-corporate-surface hover:text-corporate-ink">
            <X size={16} />
          </button>
        </div>

        <div className="grid max-h-[70vh] gap-3 overflow-y-auto p-5 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="text-[11px] font-medium uppercase text-corporate-muted">Summary</label>
            <textarea
              autoFocus
              value={form.summary}
              onChange={e => setField('summary', e.target.value)}
              className="mt-1 min-h-[84px] w-full rounded border border-corporate-line px-3 py-2 text-sm text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue"
            />
          </div>
          {[
            ['ticket_key', 'Key'],
            ['issue_type', 'Tipo'],
            ['project', 'Proyecto'],
            ['status', 'Status'],
            ['assigned_team', 'Equipo asignado'],
            ['assignee', 'Assignee'],
            ['reporter', 'Reporter'],
            ['epic_link', 'Epic Link'],
            ['priority', 'Prioridad'],
            ['sprint', 'Sprint'],
            ['labels', 'Labels'],
            ['components', 'Components'],
            ['fix_version', 'Fix Version'],
          ].map(([field, label]) => (
            <div key={field}>
              <label className="text-[11px] font-medium uppercase text-corporate-muted">{label}</label>
              <input
                type="text"
                value={(form[field as keyof CreateBacklogData] as string | null) ?? ''}
                onChange={e => setField(field as keyof CreateBacklogData, e.target.value as never)}
                className="mt-1 w-full rounded border border-corporate-line px-3 py-2 text-sm text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue"
              />
            </div>
          ))}
          <div>
            <label className="text-[11px] font-medium uppercase text-corporate-muted">Story Points</label>
            <input
              type="number"
              min="0"
              step="0.5"
              value={form.story_points ?? ''}
              onChange={e => setField('story_points', e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 w-full rounded border border-corporate-line px-3 py-2 text-sm text-corporate-ink focus:outline-none focus:ring-1 focus:ring-allianz-blue"
            />
          </div>
          {error && (
            <div className="md:col-span-2 rounded border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
              {error}
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-corporate-line px-5 py-4">
          <button
            onClick={onClose}
            disabled={saving}
            className="rounded-lg border border-corporate-line px-4 py-2 text-sm font-medium text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={handleSubmit}
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-allianz-blue px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
            Crear
          </button>
        </div>
      </div>
    </div>
  )
}

function DeleteBacklogModal({
  item,
  loading,
  error,
  onCancel,
  onConfirm,
}: {
  item: BacklogItem
  loading: boolean
  error: string | null
  onCancel: () => void
  onConfirm: () => void
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-xl border border-corporate-line bg-white shadow-2xl">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertCircle size={18} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-corporate-ink">Eliminar elemento de backlog</p>
            <p className="mt-1 text-xs text-corporate-muted">
              Se eliminará de la base de datos el elemento <span className="font-mono font-semibold text-corporate-ink">{item.ticket_key ?? `#${item.id}`}</span>.
            </p>
            <p className="mt-2 line-clamp-2 text-xs text-corporate-ink" title={item.summary}>{item.summary}</p>
            {error && <p className="mt-3 rounded border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-700">{error}</p>}
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-corporate-line px-5 py-4">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-lg border border-corporate-line px-4 py-2 text-sm font-medium text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-50"
          >
            {loading ? <Loader2 size={15} className="animate-spin" /> : <Trash2 size={15} />}
            Eliminar
          </button>
        </div>
      </div>
    </div>
  )
}

// ── Panel principal ────────────────────────────────────────────────────────────

interface Props {
  modulo: string
  active: boolean
  piActivo?: PiInfo | null
  piId?: number | null
  onCapacityRefresh?: () => void | Promise<void>
}

export function BacklogPanel({ modulo, active, piActivo, piId, onCapacityRefresh }: Props) {
  const [items, setItems]     = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [loaded, setLoaded]   = useState(false)
  const [search, setSearch]   = useState('')
  const [editing, setEditing] = useState<BacklogItem | null>(null)
  const [viewing, setViewing] = useState<BacklogItem | null>(null)
  const [creating, setCreating] = useState(false)
  const [deleting, setDeleting] = useState<BacklogItem | null>(null)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [page, setPage]       = useState(1)
  const [pageSize, setPageSize] = useState(25)

  async function load() {
    setLoading(true); setError(null)
    try {
      setItems(await getBacklog(modulo, piId))
      setLoaded(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando backlog')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoaded(false)
    setItems([])
    setPage(1)
  }, [modulo, piId])

  useEffect(() => { if (active && !loaded) load() }, [active, loaded, modulo, piId])

  function handleSaved(updated: PlanificacionData) {
    if (!editing) return
    const total = updated.planificacion_items?.length
      ? updated.planificacion_items.reduce((s, row) => s + (row.horas ?? 0), 0)
      : Object.entries(updated)
        .filter(([k]) => k.startsWith('horas_'))
        .reduce((s, [, v]) => s + ((v as number) ?? 0), 0)
    setItems(prev => prev.map(it => {
      if (it.id !== editing.id) return it
      const merged = { ...it, ...updated, total_horas: total || null, fecha_asignacion: updated.fecha_asignacion ?? null }
      return { ...merged, fecha_finalizacion: calcularFechaFin(merged, piActivo) }
    }))
  }

  async function handleDeleteConfirmed() {
    if (!deleting) return
    setDeleteLoading(true)
    setDeleteError(null)
    try {
      await deleteBacklogItem(modulo, deleting.id)
      setItems(prev => prev.filter(item => item.id !== deleting.id))
      if (editing?.id === deleting.id) setEditing(null)
      if (viewing?.id === deleting.id) setViewing(null)
      setDeleting(null)
    } catch (e: unknown) {
      setDeleteError(e instanceof Error ? e.message : 'Error eliminando elemento')
    } finally {
      setDeleteLoading(false)
    }
  }

  const filtered = items.filter(item => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      (item.ticket_key ?? '').toLowerCase().includes(q) ||
      item.summary.toLowerCase().includes(q) ||
      (item.epic_link ?? '').toLowerCase().includes(q) ||
      (item.assignee ?? '').toLowerCase().includes(q) ||
      responsablesByPerfil(item).some(({ responsables }) =>
        responsables.some(nombre => nombre.toLowerCase().includes(q))
      )
    )
  })
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStartIndex = (currentPage - 1) * pageSize
  const pageItems = filtered.slice(pageStartIndex, pageStartIndex + pageSize)
  const resultStart = filtered.length > 0 ? pageStartIndex + 1 : 0
  const resultEnd = Math.min(pageStartIndex + pageSize, filtered.length)
  const statusOptions = Array.from(new Set([...STATUS_OPTIONS, ...items.map(item => item.status).filter(Boolean) as string[]]))

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, items.length])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  if (loading) return (
    <div className="flex items-center justify-center py-16 gap-2 text-corporate-muted">
      <Loader2 size={20} className="animate-spin" /> Cargando backlog…
    </div>
  )
  if (error) return (
    <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
      <AlertCircle size={16} className="text-red-600" />
      <span className="text-sm text-red-700">{error}</span>
      <button onClick={load} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-800">
        <RefreshCw size={12} /> Reintentar
      </button>
    </div>
  )
  if (loaded && items.length === 0) return (
    <>
      {creating && (
        <ManualBacklogModal
          modulo={modulo}
          piId={piId}
          onClose={() => setCreating(false)}
          onCreated={created => setItems([created])}
        />
      )}
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-corporate-ink">Sin tickets en el backlog</p>
        <p className="text-xs text-corporate-muted">Sube un archivo Excel desde <strong>Subir Info MD/FA</strong> o crea un elemento manual.</p>
        <button
          onClick={() => setCreating(true)}
          className="inline-flex items-center gap-1.5 rounded-lg bg-allianz-blue px-3 py-2 text-xs font-semibold text-white hover:bg-blue-700"
        >
          <Plus size={14} /> Nuevo elemento
        </button>
      </div>
    </>
  )

  return (
    <>
      {editing && (
        <PlanificacionModal item={editing} modulo={modulo}
          onClose={() => setEditing(null)} onSaved={handleSaved} onCapacityRefresh={onCapacityRefresh} piId={piId} />
      )}
      {viewing && (
        <BacklogDetailModal
          item={viewing}
          modulo={modulo}
          onClose={() => setViewing(null)}
          onSaved={patch => {
            setViewing(prev => prev ? { ...prev, ...patch } : prev)
            setItems(prev => prev.map(it => it.id === viewing.id ? { ...it, ...patch } : it))
          }}
          piActivo={piActivo}
          statusOptions={statusOptions}
        />
      )}
      {creating && (
        <ManualBacklogModal
          modulo={modulo}
          piId={piId}
          onClose={() => setCreating(false)}
          onCreated={created => {
            setItems(prev => [created, ...prev])
            setPage(1)
          }}
        />
      )}
      {deleting && (
        <DeleteBacklogModal
          item={deleting}
          loading={deleteLoading}
          error={deleteError}
          onCancel={() => { setDeleting(null); setDeleteError(null) }}
          onConfirm={handleDeleteConfirmed}
        />
      )}

      <div className="space-y-3">
        {/* barra búsqueda */}
        <div className="flex items-center gap-3">
          <input type="text" placeholder="Buscar por ticket, resumen, épica, asignado, responsable…"
            value={search} onChange={e => setSearch(e.target.value)}
            className="flex-1 rounded-lg border border-corporate-line bg-white px-3 py-1.5 text-xs text-corporate-ink placeholder:text-corporate-muted focus:outline-none focus:ring-1 focus:ring-allianz-blue" />
          <span className="text-xs text-corporate-muted whitespace-nowrap">
            {filtered.length}/{items.length} tickets
          </span>
          <button onClick={() => setCreating(true)}
            className="flex items-center gap-1 rounded-lg bg-allianz-blue px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-blue-700 transition-colors">
            <Plus size={12} /> Nuevo
          </button>
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-corporate-line bg-white px-2.5 py-1.5 text-xs text-corporate-muted hover:text-corporate-ink transition-colors">
            <RefreshCw size={12} /> Actualizar
          </button>
        </div>

        <PaginationControls
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={filtered.length}
          start={resultStart}
          end={resultEnd}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />

        {/* tabla */}
        <div className="overflow-hidden rounded-xl border border-corporate-line shadow-sm">
          <div className="overflow-x-auto">
          <table className="w-full min-w-[1160px] table-auto text-xs border-collapse">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="w-10 px-3 py-3 text-left font-semibold border-r border-white/10 shrink-0">Plan</th>
                <th className="min-w-[100px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Key</th>
                <th className="min-w-[120px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Asignación</th>
                <th className="min-w-[120px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Finalización</th>
                <th className="min-w-[120px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Escalado</th>
                <th className="min-w-[120px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Reinicio</th>
                <th className="min-w-[70px] px-3 py-3 text-right font-semibold whitespace-nowrap border-r border-white/10">ETC</th>
                <th className="px-3 py-3 text-left font-semibold border-r border-white/10">Summary</th>
                <th className="min-w-[160px] px-3 py-3 text-left font-semibold border-r border-white/10">Equipo</th>
                <th className="min-w-[80px] px-3 py-3 text-right font-semibold whitespace-nowrap border-r border-white/10">Total h.</th>
                <th className="min-w-[110px] px-3 py-3 text-center font-semibold">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {pageItems.map((item, idx) => {
                const isEven = (pageStartIndex + idx) % 2 === 0
                const planned = !!item.total_horas
                return (
                  <tr key={item.id}
                    className={clsx(
                      'border-b border-corporate-line transition-colors hover:bg-blue-50/40',
                      isEven ? 'bg-white' : 'bg-slate-50/60',
                    )}>
                    <td className="px-2 py-2 border-r border-corporate-line/50">
                      <button onClick={() => setEditing(item)} title="Planificar"
                        className={clsx(
                          'flex items-center justify-center w-7 h-7 rounded-lg transition-colors',
                          planned
                            ? 'bg-allianz-blue text-white hover:bg-blue-700 shadow-sm'
                            : 'bg-corporate-surface text-corporate-muted hover:bg-corporate-line',
                        )}>
                        <ClipboardEdit size={13} />
                      </button>
                    </td>
                    <td className="px-3 py-2 border-r border-corporate-line/30">
                      <span className="font-mono font-semibold text-allianz-blue whitespace-nowrap">{item.ticket_key ?? '—'}</span>
                    </td>
                    <td className="px-2 py-1.5 border-r border-corporate-line/30">
                      <FechaAsignacionCell
                        item={item}
                        modulo={modulo}
                        onSaved={(fecha, fechaFinalizacion) =>
                          setItems(prev => prev.map(it => {
                            if (it.id !== item.id) return it
                            const updated = { ...it, fecha_asignacion: fecha }
                            return { ...updated, fecha_finalizacion: fechaFinalizacion ?? calcularFechaFin(updated, piActivo) }
                          }))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 border-r border-corporate-line/30">
                      {(() => {
                        const fin = item.fecha_finalizacion ?? calcularFechaFin(item, piActivo)
                        return fin
                          ? <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700"><CalendarDays size={11} className="shrink-0" />{fin}</span>
                          : <span className="text-corporate-muted text-xs">—</span>
                      })()}
                    </td>
                    <td className="px-2 py-1.5 border-r border-corporate-line/30">
                      <EscalamientoDateCell
                        item={item}
                        modulo={modulo}
                        field="fecha_escalado"
                        onSaved={updated =>
                          setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...updated } : it))
                        }
                      />
                    </td>
                    <td className="px-2 py-1.5 border-r border-corporate-line/30">
                      <EscalamientoDateCell
                        item={item}
                        modulo={modulo}
                        field="fecha_reinicio"
                        onSaved={updated =>
                          setItems(prev => prev.map(it => it.id === item.id ? { ...it, ...updated } : it))
                        }
                      />
                    </td>
                    <td className="px-3 py-2 text-right border-r border-corporate-line/30">
                      {(() => {
                        const etc = calcularEtc(item, piActivo)
                        return etc > 0
                          ? <span className="font-mono font-bold text-orange-700">{etc}d</span>
                          : <span className="text-corporate-muted">—</span>
                      })()}
                    </td>
                    <td className="px-3 py-2 align-top border-r border-corporate-line/30">
                      <span className="line-clamp-2 text-corporate-ink leading-snug" title={item.summary}>{item.summary}</span>
                    </td>
                    <td className="px-3 py-2 border-r border-corporate-line/30">
                      <ResponsablesCell item={item} />
                    </td>
                    <td className="px-3 py-2 text-right border-r border-corporate-line/30">
                      {planned
                        ? <span className="font-mono font-bold text-allianz-blue">{item.total_horas}h</span>
                        : <span className="text-corporate-muted">—</span>
                      }
                    </td>
                    <td className="px-2 py-2">
                      <div className="flex items-center justify-center gap-1">
                      <button
                        onClick={() => setViewing(item)}
                        title="Ver detalle"
                        className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-corporate-muted hover:bg-corporate-surface hover:text-allianz-blue"
                      >
                        <Eye size={14} />
                        Ver
                      </button>
                      <button
                        onClick={() => { setDeleting(item); setDeleteError(null) }}
                        title="Eliminar de la base de datos"
                        className="inline-flex h-7 items-center justify-center rounded-lg px-2 text-red-500 hover:bg-red-50 hover:text-red-700"
                      >
                        <Trash2 size={14} />
                      </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          </div>
        </div>

        <PaginationControls
          page={currentPage}
          pageCount={pageCount}
          pageSize={pageSize}
          total={filtered.length}
          start={resultStart}
          end={resultEnd}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>
    </>
  )
}
