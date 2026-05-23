import { useEffect, useState } from 'react'
import {
  UserPlus, Trash2, Check, X, AlertTriangle, RefreshCw, Search,
  Users, Clock3, Activity, Layers, ListFilter, ChevronDown, ChevronRight,
} from 'lucide-react'
import clsx from 'clsx'
import { AsignacionPersona, PersonaCapacidad, PeriodoOcupado, PiInfo } from '../../types'
import { patchPlanificacionItem } from '../../services/api'
import { DataPanel, KpiCard, StatusBadge } from '../ui/Corporate'
import {
  createNovedadDisponibilidad,
  crearPersonaEnCapacidad,
  deleteNovedadDisponibilidad,
  getNovedadesDisponibilidad,
  NovedadDisponibilidad,
  removePersonaCapacidad,
  sincronizarCapacidadAPI,
} from '../../services/api'

function ConfirmModal({
  nombre,
  onConfirm,
  onCancel,
  loading,
}: {
  nombre: string
  onConfirm: () => void
  onCancel: () => void
  loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[1px]" onClick={onCancel} />
      <div className="relative w-full max-w-sm rounded-xl border border-corporate-line bg-white shadow-xl">
        <div className="flex items-start gap-3 p-5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-red-50 text-red-600">
            <AlertTriangle size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-corporate-ink">Quitar capacidad del equipo</p>
            <p className="mt-1 text-xs text-corporate-muted">
              ¿Confirmas que deseas quitar a <span className="font-medium text-corporate-ink">{nombre}</span> de la capacidad de este equipo en el PI? La persona no se eliminará del sistema.
            </p>
          </div>
        </div>
        <div className="flex justify-end gap-2 border-t border-corporate-line px-5 py-3">
          <button
            onClick={onCancel}
            disabled={loading}
            className="rounded-md border border-corporate-line bg-white px-4 py-1.5 text-xs font-medium text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
          >
            Cancelar
          </button>
          <button
            onClick={onConfirm}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-red-600 px-4 py-1.5 text-xs font-medium text-white hover:bg-red-700 disabled:opacity-40"
          >
            <Trash2 size={12} />
            {loading ? 'Quitando…' : 'Quitar'}
          </button>
        </div>
      </div>
    </div>
  )
}

interface Props {
  personas: PersonaCapacidad[]
  piId?: number
  horasPorPersona?: number
  onRefresh?: () => void
  modulo?: string
  pi?: PiInfo | null
}

const estadoColor: Record<string, string> = {
  'DISPONIBLE':    'green',
  'OCUPADO':       'amber',
  'SOBRECARGADO':  'red',
  'LIDER TECNICO': 'purple',
  'SIN CAPACIDAD': 'neutral',
}

type VistaCapacidad = 'riesgo' | 'tecnologia'
type TecnologiaCapacidad = 'JAVA' | 'COBOL' | 'CALIDAD' | 'GESTION' | 'QA'
type FiltroCapacidad = 'TODOS' | 'SOBRECARGADO' | 'DISPONIBLE' | 'OCUPADO' | 'SIN_CAPACIDAD' | TecnologiaCapacidad

const FILTERS: { id: FiltroCapacidad; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'SOBRECARGADO', label: 'Sobrecargados' },
  { id: 'DISPONIBLE', label: 'Disponibles' },
  { id: 'OCUPADO', label: 'Ocupados' },
  { id: 'SIN_CAPACIDAD', label: 'Sin capacidad' },
  { id: 'JAVA', label: 'JAVA' },
  { id: 'COBOL', label: 'COBOL' },
  { id: 'CALIDAD', label: 'Calidad' },
  { id: 'GESTION', label: 'Gestión' },
]

function tecnologiaLabel(tecnologia: string) {
  if (tecnologia === 'CALIDAD' || tecnologia === 'QA') return 'Calidad'
  if (tecnologia === 'GESTION') return 'Gestión'
  return tecnologia
}

function tecnologiaTone(tecnologia: string) {
  if (tecnologia === 'JAVA') return 'blue'
  if (tecnologia === 'COBOL') return 'green'
  if (tecnologia === 'CALIDAD' || tecnologia === 'QA') return 'purple'
  return 'amber'
}

const riskRank: Record<string, number> = {
  'SOBRECARGADO': 0,
  'SIN CAPACIDAD': 1,
  'OCUPADO': 2,
  'LIDER TECNICO': 3,
  'DISPONIBLE': 4,
}

function ocupacionPct(persona: PersonaCapacidad): number | null {
  return persona.capacidad ? Math.round(((persona.consumo_total ?? persona.carga_estimada) / persona.capacidad) * 100) : null
}

function sortByRisk(rows: PersonaCapacidad[]) {
  return [...rows].sort((a, b) => {
    const rankDiff = (riskRank[a.estado] ?? 99) - (riskRank[b.estado] ?? 99)
    if (rankDiff !== 0) return rankDiff
    const dispA = a.horas_disponibles ?? Number.MAX_SAFE_INTEGER
    const dispB = b.horas_disponibles ?? Number.MAX_SAFE_INTEGER
    if (dispA !== dispB) return dispA - dispB
    return (ocupacionPct(b) ?? 0) - (ocupacionPct(a) ?? 0)
  })
}

function formatHours(value: number | null | undefined) {
  if (value == null) return '—'
  return `${Math.round(value * 10) / 10}h`
}


function AddPersonaForm({
  horasPorPersona,
  onDone,
  onCancel,
  onSubmit,
}: {
  horasPorPersona: number
  onDone: () => void
  onCancel: () => void
  onSubmit: (nombre: string, apellidos: string, tecnologia: TecnologiaCapacidad) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [tecnologia, setTecnologia] = useState<TecnologiaCapacidad>('JAVA')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!nombre.trim() || !apellidos.trim()) {
      setError('Nombre y apellidos son obligatorios')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(nombre.trim(), apellidos.trim(), tecnologia)
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear persona')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-allianz-blue/20 bg-blue-50 p-4">
      <p className="mb-3 text-xs font-semibold text-allianz-blue">Nueva persona</p>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Nombre</label>
          <input
            autoFocus
            type="text"
            placeholder="Ej: Juan"
            className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink w-36"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Apellidos</label>
          <input
            type="text"
            placeholder="Ej: García López"
            className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink w-44"
            value={apellidos}
            onChange={e => setApellidos(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Tecnología</label>
          <select
            className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink w-24"
            value={tecnologia}
            onChange={e => setTecnologia(e.target.value as TecnologiaCapacidad)}
          >
            <option value="JAVA">JAVA</option>
            <option value="COBOL">COBOL</option>
            <option value="CALIDAD">Calidad</option>
            <option value="GESTION">Gestión</option>
          </select>
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Capacidad</label>
          <div className="flex items-center rounded border border-corporate-line bg-gray-100 px-2 py-1.5 text-xs text-corporate-muted w-24">
            {horasPorPersona}h (del PI)
          </div>
        </div>
      </div>
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      <div className="mt-3 flex gap-2">
        <button
          onClick={handleSubmit}
          disabled={saving}
          className="flex items-center gap-1 rounded-md bg-allianz-blue px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40"
        >
          <Check size={13} /> {saving ? 'Guardando…' : 'Agregar'}
        </button>
        <button
          onClick={onCancel}
          className="flex items-center gap-1 rounded-md border border-corporate-line bg-white px-3 py-1.5 text-xs text-corporate-muted hover:text-corporate-ink"
        >
          <X size={13} /> Cancelar
        </button>
      </div>
    </div>
  )
}

function NovedadesPanel({
  piId,
  personas,
  onRefresh,
}: {
  piId?: number
  personas: PersonaCapacidad[]
  onRefresh?: () => void
}) {
  const [rows, setRows] = useState<NovedadDisponibilidad[]>([])
  const [personaId, setPersonaId] = useState<number | ''>('')
  const [tipo, setTipo] = useState('VACACIONES')
  const [fechaInicio, setFechaInicio] = useState('')
  const [fechaFin, setFechaFin] = useState('')
  const [horasPorDia, setHorasPorDia] = useState('')
  const [descripcion, setDescripcion] = useState('')
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function load() {
    if (!piId) return
    setLoading(true)
    setError(null)
    try {
      setRows(await getNovedadesDisponibilidad(piId))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando novedades')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [piId])

  async function add() {
    if (!piId || !personaId || !fechaInicio || !fechaFin) {
      setError('Persona y fechas son obligatorias')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const created = await createNovedadDisponibilidad(piId, {
        persona_id: personaId,
        tipo,
        fecha_inicio: fechaInicio,
        fecha_fin: fechaFin,
        horas_por_dia: horasPorDia === '' ? null : Number(horasPorDia),
        descripcion: descripcion.trim() || null,
      })
      setRows(prev => [created, ...prev])
      setPersonaId('')
      setFechaInicio('')
      setFechaFin('')
      setHorasPorDia('')
      setDescripcion('')
      onRefresh?.()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error creando novedad')
    } finally {
      setSaving(false)
    }
  }

  async function remove(id: number) {
    if (!piId) return
    await deleteNovedadDisponibilidad(piId, id)
    setRows(prev => prev.filter(row => row.id !== id))
    onRefresh?.()
  }

  if (!piId) return null

  return (
    <DataPanel title="Novedades de disponibilidad" description="Ausencias y eventos que descuentan capacidad automáticamente">
      <div className="space-y-3">
        <div className="grid gap-2 md:grid-cols-[1.4fr_120px_130px_130px_100px_1fr_auto]">
          <select
            value={personaId}
            onChange={e => setPersonaId(e.target.value ? Number(e.target.value) : '')}
            className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink"
          >
            <option value="">Persona</option>
            {personas.map(p => <option key={p.id} value={p.id}>{p.nombre}</option>)}
          </select>
          <select value={tipo} onChange={e => setTipo(e.target.value)} className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink">
            <option value="VACACIONES">Vacaciones</option>
            <option value="INCAPACIDAD">Incapacidad</option>
            <option value="PERMISO">Permiso</option>
            <option value="CALAMIDAD">Calamidad</option>
            <option value="LICENCIA">Licencia</option>
          </select>
          <input type="date" value={fechaInicio} onChange={e => setFechaInicio(e.target.value)} className="rounded border border-corporate-line px-2 py-1.5 text-xs" />
          <input type="date" value={fechaFin} onChange={e => setFechaFin(e.target.value)} className="rounded border border-corporate-line px-2 py-1.5 text-xs" />
          <input type="number" min="0" step="0.5" placeholder="h/día" value={horasPorDia} onChange={e => setHorasPorDia(e.target.value)} className="rounded border border-corporate-line px-2 py-1.5 text-xs" />
          <input type="text" placeholder="Descripción" value={descripcion} onChange={e => setDescripcion(e.target.value)} className="rounded border border-corporate-line px-2 py-1.5 text-xs" />
          <button onClick={add} disabled={saving} className="inline-flex items-center justify-center gap-1 rounded-md bg-allianz-blue px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40">
            {saving ? <RefreshCw size={13} className="animate-spin" /> : <Check size={13} />}
            Agregar
          </button>
        </div>

        {error && <p className="text-xs text-red-600">{error}</p>}
        {loading ? (
          <p className="text-xs text-corporate-muted">Cargando novedades…</p>
        ) : rows.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="corporate-table">
              <thead>
                <tr>
                  {['Persona', 'Tipo', 'Inicio', 'Fin', 'Horas/día', 'Descripción', ''].map(h => <th key={h}>{h}</th>)}
                </tr>
              </thead>
              <tbody>
                {rows.map(row => (
                  <tr key={row.id}>
                    <td className="font-medium text-corporate-ink">{row.persona_nombre}</td>
                    <td><StatusBadge tone="amber">{row.tipo}</StatusBadge></td>
                    <td className="font-mono">{row.fecha_inicio}</td>
                    <td className="font-mono">{row.fecha_fin}</td>
                    <td className="text-right font-mono">{formatHours(row.horas_por_dia)}</td>
                    <td>{row.descripcion ?? '—'}</td>
                    <td>
                      <button onClick={() => remove(row.id)} className="rounded p-1 text-red-500 hover:bg-red-50" title="Eliminar novedad">
                        <Trash2 size={13} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-xs text-corporate-muted">Sin novedades registradas para este PI.</p>
        )}
      </div>
    </DataPanel>
  )
}

function FilterButton({
  active,
  label,
  onClick,
}: {
  active: boolean
  label: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={clsx(
        'rounded-md border px-2.5 py-1.5 text-xs font-medium transition-colors',
        active
          ? 'border-allianz-blue bg-blue-50 text-allianz-blue'
          : 'border-corporate-line bg-white text-corporate-muted hover:text-corporate-ink',
      )}
    >
      {label}
    </button>
  )
}

function CapacitySummary({
  personas,
}: {
  personas: PersonaCapacidad[]
}) {
  const consumoTotal = personas.reduce((sum, p) => sum + (p.consumo_total ?? p.carga_estimada ?? 0), 0)
  const novedadesTotal = personas.reduce((sum, p) => sum + (p.novedades_horas ?? 0), 0)
  const sobrecargados = personas.filter(p => p.estado === 'SOBRECARGADO')
  const exceso = sobrecargados.reduce((sum, p) => sum + Math.max(0, -(p.horas_disponibles ?? 0)), 0)

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <KpiCard
        label="Personas"
        value={personas.length}
        icon={Users}
        tone="blue"
        detail={`${sobrecargados.length} sobrecargados`}
      />
      <KpiCard
        label="Horas asignadas"
        value={`${Math.round(consumoTotal)}h`}
        icon={Clock3}
        tone={sobrecargados.length > 0 ? 'red' : 'green'}
        detail={`${personas.filter(p => p.carga_estimada > 0).length} con asignaciones`}
      />
      <KpiCard
        label="Novedades"
        value={`${Math.round(novedadesTotal)}h`}
        icon={AlertTriangle}
        tone={novedadesTotal > 0 ? 'amber' : 'neutral'}
        detail="ausencias registradas"
      />
      <KpiCard
        label="Sobrecargados"
        value={sobrecargados.length}
        icon={Activity}
        tone={sobrecargados.length > 0 ? 'red' : 'green'}
        detail={sobrecargados.length > 0 ? `${Math.round(exceso)}h de exceso` : 'Sin exceso'}
      />
    </div>
  )
}

function diffDays(a: Date, b: Date) {
  return Math.round((a.getTime() - b.getTime()) / 86_400_000)
}

function parseISO(d: string | null | undefined): Date | null {
  if (!d) return null
  const dt = new Date(`${d}T00:00:00`)
  return Number.isNaN(dt.getTime()) ? null : dt
}

function formatShortDate(iso: string | null | undefined) {
  const d = parseISO(iso)
  if (!d) return '—'
  return d.toLocaleDateString('es', { day: '2-digit', month: 'short' })
}

function TimelineStrip({
  pi,
  periodos,
}: {
  pi: PiInfo
  periodos: PeriodoOcupado[]
}) {
  const start = parseISO(pi.fecha_inicio)
  const end = parseISO(pi.fecha_fin)
  if (!start || !end) return null
  const totalDays = Math.max(diffDays(end, start) + 1, 1)
  return (
    <div className="space-y-1">
      <div className="relative h-4 rounded bg-green-50 ring-1 ring-green-100">
        {periodos.map((p, idx) => {
          const s = parseISO(p.desde)
          const e = parseISO(p.hasta)
          if (!s || !e) return null
          const leftDays = Math.max(diffDays(s, start), 0)
          const widthDays = Math.max(diffDays(e, s) + 1, 1)
          const left = (leftDays / totalDays) * 100
          const width = (widthDays / totalDays) * 100
          const color =
            p.motivo === 'NOVEDAD' ? 'bg-amber-400' : 'bg-allianz-blue/70'
          return (
            <div
              key={idx}
              className={clsx('absolute top-0 h-full rounded', color)}
              style={{ left: `${left}%`, width: `${Math.max(width, 0.6)}%` }}
              title={`${p.motivo === 'NOVEDAD' ? 'Novedad' : 'Asignación'}: ${p.desde} → ${p.hasta}`}
            />
          )
        })}
      </div>
      <div className="flex justify-between text-[10px] text-corporate-muted">
        <span>{formatShortDate(pi.fecha_inicio)}</span>
        <span>{formatShortDate(pi.fecha_fin)}</span>
      </div>
    </div>
  )
}

const PLAN_STATUS_OPTIONS = ['In Progress', 'Done', 'Blocked', 'Cancelled']
const PLAN_STATUS_TONE: Record<string, string> = {
  'In Progress': 'blue',
  'Done': 'green',
  'Blocked': 'red',
  'Cancelled': 'neutral',
}

function AsignacionRow({
  asignacion,
  onRefresh,
}: {
  asignacion: AsignacionPersona
  onRefresh?: () => void
}) {
  const [saving, setSaving] = useState(false)
  const [localStatus, setLocalStatus] = useState(asignacion.plan_status ?? '')
  const [localPi, setLocalPi] = useState(asignacion.pi ?? '')
  const [localInicio, setLocalInicio] = useState(asignacion.fecha_inicio ?? '')
  const [localFin, setLocalFin] = useState(asignacion.fecha_fin ?? '')

  const canEdit = asignacion.backlog_item_id != null && asignacion.plan_item_index != null

  async function save(changes: { fecha_inicio?: string | null; fecha_fin?: string | null; status?: string | null; pi?: string | null }) {
    if (!canEdit) return
    setSaving(true)
    try {
      await patchPlanificacionItem(
        asignacion.modulo ?? 'FABRICA',
        asignacion.backlog_item_id!,
        asignacion.plan_item_index!,
        changes,
      )
      onRefresh?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <tr className={saving ? 'opacity-60' : ''}>
      <td className="whitespace-nowrap font-mono text-[11px] font-medium text-allianz-blue">{asignacion.ticket_key ?? '—'}</td>
      <td className="max-w-[220px] truncate text-corporate-ink" title={asignacion.summary ?? ''}>{asignacion.summary ?? '—'}</td>
      <td><StatusBadge tone={asignacion.modulo === 'FABRICA' ? 'blue' : 'purple'}>{asignacion.modulo === 'MEJORA_CONTINUA' ? 'Mejora' : 'Fábrica'}</StatusBadge></td>
      <td className="text-corporate-muted">{asignacion.perfil}</td>
      <td className="text-corporate-muted">{asignacion.fase}</td>
      <td>
        {canEdit ? (
          <input
            type="date"
            value={localInicio}
            disabled={saving}
            onChange={e => setLocalInicio(e.target.value)}
            onBlur={() => save({ fecha_inicio: localInicio || null })}
            className="rounded border border-corporate-line px-1 py-0.5 font-mono text-[11px] disabled:bg-gray-50"
          />
        ) : (
          <span className="font-mono text-[11px]">{formatShortDate(asignacion.fecha_inicio)}</span>
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="date"
            value={localFin}
            disabled={saving}
            onChange={e => setLocalFin(e.target.value)}
            onBlur={() => save({ fecha_fin: localFin || null })}
            className="rounded border border-corporate-line px-1 py-0.5 font-mono text-[11px] disabled:bg-gray-50"
          />
        ) : (
          <span className="font-mono text-[11px]">{formatShortDate(asignacion.fecha_fin)}</span>
        )}
      </td>
      <td className="text-right font-mono">{formatHours(asignacion.horas)}</td>
      <td>
        {canEdit ? (
          <select
            value={localStatus}
            disabled={saving}
            onChange={e => {
              const val = e.target.value
              setLocalStatus(val)
              save({ status: val || null })
            }}
            className="rounded border border-corporate-line bg-white px-1 py-0.5 text-[11px] text-corporate-ink disabled:bg-gray-50"
          >
            <option value="">—</option>
            {PLAN_STATUS_OPTIONS.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        ) : (
          localStatus ? <StatusBadge tone={PLAN_STATUS_TONE[localStatus] as never}>{localStatus}</StatusBadge> : <span className="text-corporate-muted">—</span>
        )}
      </td>
      <td>
        {canEdit ? (
          <input
            type="text"
            value={localPi}
            disabled={saving}
            onChange={e => setLocalPi(e.target.value)}
            onBlur={() => save({ pi: localPi.trim() || null })}
            placeholder="—"
            className="w-24 rounded border border-corporate-line px-1 py-0.5 text-[11px] text-corporate-ink placeholder:text-corporate-muted disabled:bg-gray-50"
          />
        ) : (
          <span className="text-[11px] text-corporate-muted">{localPi || '—'}</span>
        )}
      </td>
    </tr>
  )
}

function AsignacionesList({ asignaciones, onRefresh }: { asignaciones: AsignacionPersona[]; onRefresh?: () => void }) {
  if (!asignaciones.length) {
    return <p className="text-xs text-corporate-muted">Sin asignaciones registradas.</p>
  }
  return (
    <div className="overflow-x-auto">
      <table className="corporate-table">
        <thead>
          <tr>
            {['KEY', 'Resumen', 'Módulo', 'Perfil', 'Fase', 'Inicio', 'Fin', 'Horas', 'Status', 'PI'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {asignaciones.map((a, idx) => (
            <AsignacionRow key={`${a.backlog_item_id ?? 'noid'}-${a.plan_item_index ?? idx}`} asignacion={a} onRefresh={onRefresh} />
          ))}
        </tbody>
      </table>
    </div>
  )
}

function PersonaDetalleRow({
  persona,
  pi,
  colSpan,
  onRefresh,
}: {
  persona: PersonaCapacidad
  pi?: PiInfo | null
  colSpan: number
  onRefresh?: () => void
}) {
  const asignaciones = persona.asignaciones ?? []
  const periodos = persona.periodos_ocupados ?? []
  return (
    <tr className="bg-corporate-surface/60">
      <td colSpan={colSpan} className="px-4 py-4">
        <div className="space-y-4">
          {pi && (
            <div>
              <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-corporate-muted">
                Periodos no disponibles · {pi.nombre}
              </p>
              {periodos.length === 0 ? (
                <p className="text-xs text-green-700">Sin asignaciones ni novedades dentro del PI.</p>
              ) : (
                <TimelineStrip pi={pi} periodos={periodos} />
              )}
              {periodos.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-3 text-[10px] text-corporate-muted">
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-allianz-blue/70" /> Asignaciones</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-amber-400" /> Novedades</span>
                  <span className="inline-flex items-center gap-1"><span className="inline-block h-2 w-3 rounded bg-green-50 ring-1 ring-green-200" /> Disponible</span>
                </div>
              )}
            </div>
          )}
          <div>
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-corporate-muted">
              KEYs asignados ({asignaciones.length})
            </p>
            <AsignacionesList asignaciones={asignaciones} onRefresh={onRefresh} />
          </div>
        </div>
      </td>
    </tr>
  )
}

function CapacityTable({
  title,
  description,
  rows,
  piId,
  onRefresh,
  horasPorPersona,
  onRemove,
  onAdd,
  pi,
  expandedId,
  onToggleExpand,
}: {
  title: string
  description: string
  rows: PersonaCapacidad[]
  piId?: number
  onRefresh?: () => void
  horasPorPersona: number
  onRemove: (persona: PersonaCapacidad) => void
  onAdd: () => void
  pi?: PiInfo | null
  expandedId: number | null
  onToggleExpand: (personaId: number) => void
}) {
  const hasActions = !!(piId && onRefresh)
  const totalCols = 1 + 4 + (hasActions ? 1 : 0)
  return (
    <DataPanel title={title} description={description}>
      <div className="overflow-x-auto">
        <table className="corporate-table">
          <thead>
            <tr>
              {['', 'Nombre', 'Tecnología', 'Horas asignadas', 'Estado', ...(hasActions ? [''] : [])].map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={totalCols} className="px-3 py-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <p className="text-xs text-corporate-muted">Sin personas para este filtro.</p>
                    {piId && onRefresh && (
                      <button
                        type="button"
                        onClick={onAdd}
                        className="inline-flex items-center gap-1.5 rounded-md border border-allianz-blue/30 bg-blue-50 px-3 py-1.5 text-xs font-medium text-allianz-blue hover:bg-blue-100"
                      >
                        <UserPlus size={13} /> Agregar persona
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : rows.flatMap((p) => {
              const isExpanded = expandedId === p.id
              const numAsignaciones = p.asignaciones?.length ?? 0
              const rowEls = [
                <tr key={p.id} className={clsx(
                  'border-l-4 hover:bg-blue-50/30 transition-colors',
                  p.estado === 'SOBRECARGADO' ? 'border-l-red-500' :
                  p.estado === 'OCUPADO' ? 'border-l-amber-400' :
                  p.estado === 'DISPONIBLE' ? 'border-l-green-400' :
                  'border-l-transparent',
                )}>
                  <td className="w-8">
                    <button
                      type="button"
                      onClick={() => onToggleExpand(p.id)}
                      className="inline-flex items-center gap-1 rounded p-1 text-corporate-muted hover:bg-corporate-line/50 hover:text-corporate-ink"
                      title={isExpanded ? 'Ocultar detalle' : 'Ver KEYs y disponibilidad'}
                    >
                      {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                      {numAsignaciones > 0 && (
                        <span className="rounded bg-blue-50 px-1 text-[10px] font-semibold text-allianz-blue">{numAsignaciones}</span>
                      )}
                    </button>
                  </td>
                  <td className="whitespace-nowrap font-medium text-corporate-ink">
                    {p.nombre}
                    {p.senior && (
                      <span className="ml-1.5 rounded bg-purple-100 px-1.5 py-0.5 text-[10px] font-semibold text-purple-700">Senior</span>
                    )}
                  </td>
                  <td><StatusBadge tone={tecnologiaTone(p.tecnologia) as never}>{tecnologiaLabel(p.tecnologia)}</StatusBadge></td>
                  <td className="text-right">
                    <span className="font-mono font-semibold text-corporate-ink">{formatHours(p.consumo_total ?? p.carga_estimada)}</span>
                  </td>
                  <td>
                    <StatusBadge tone={estadoColor[p.estado] as never}>{p.estado}</StatusBadge>
                  </td>
                  {piId && onRefresh && (
                    <td>
                      <button
                        onClick={() => onRemove(p)}
                        className="inline-flex items-center justify-center rounded border border-red-100 bg-red-50 p-1 text-red-500 hover:border-red-200 hover:bg-red-100"
                        title="Quitar capacidad del equipo"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>,
              ]
              if (isExpanded) {
                rowEls.push(
                  <PersonaDetalleRow key={`${p.id}-detalle`} persona={p} pi={pi} colSpan={totalCols} onRefresh={onRefresh} />,
                )
              }
              return rowEls
            })}
          </tbody>
        </table>
      </div>
    </DataPanel>
  )
}

export function CapacidadPanel({ personas, piId, horasPorPersona = 0, onRefresh, modulo = 'FABRICA', pi }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState<{ id: number; nombre: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [vista, setVista] = useState<VistaCapacidad>('riesgo')
  const [filtro, setFiltro] = useState<FiltroCapacidad>('TODOS')
  const [search, setSearch] = useState('')
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const toggleExpand = (personaId: number) =>
    setExpandedId(prev => (prev === personaId ? null : personaId))

  const filtered = sortByRisk(personas).filter(p => {
    if (filtro === 'CALIDAD' && p.tecnologia !== 'CALIDAD' && p.tecnologia !== 'QA') return false
    if (filtro === 'GESTION' && p.tecnologia !== 'GESTION') return false
    if ((filtro === 'JAVA' || filtro === 'COBOL' || filtro === 'QA') && p.tecnologia !== filtro) return false
    if (filtro === 'SIN_CAPACIDAD' && p.estado !== 'SIN CAPACIDAD') return false
    if (filtro !== 'TODOS' && filtro !== 'JAVA' && filtro !== 'COBOL' && filtro !== 'QA' && filtro !== 'CALIDAD' && filtro !== 'GESTION' && filtro !== 'SIN_CAPACIDAD' && p.estado !== filtro) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${p.nombre} ${p.tecnologia} ${p.estado}`.toLowerCase().includes(q)
  })
  const cobol = filtered.filter(p => p.tecnologia === 'COBOL')
  const java  = filtered.filter(p => p.tecnologia === 'JAVA')
  const calidad = filtered.filter(p => p.tecnologia === 'CALIDAD' || p.tecnologia === 'QA')
  const gestion = filtered.filter(p => p.tecnologia === 'GESTION')

  async function handleConfirmRemove() {
    if (!confirm || !piId || !onRefresh) return
    setRemoving(true)
    try {
      await removePersonaCapacidad(piId, confirm.id)
      onRefresh()
    } finally {
      setRemoving(false)
      setConfirm(null)
    }
  }

  async function handleCrear(nombre: string, apellidos: string, tecnologia: TecnologiaCapacidad) {
    if (!piId) throw new Error('Sin PI activo')
    await crearPersonaEnCapacidad(piId, { nombre, apellidos, tecnologia, modulo })
  }

  async function handleSincronizar() {
    if (!piId || !onRefresh) return
    setSyncing(true)
    setSyncMsg(null)
    try {
      const res = await sincronizarCapacidadAPI(piId)
      onRefresh()
      setSyncMsg({ ok: true, text: `${res.actualizado} persona${res.actualizado !== 1 ? 's' : ''} actualizadas a ${res.horas_por_persona}h` })
    } catch (e: unknown) {
      setSyncMsg({ ok: false, text: e instanceof Error ? e.message : 'Error al sincronizar' })
    } finally {
      setSyncing(false)
    }
  }

  return (
    <div className="space-y-4">
      {confirm && (
        <ConfirmModal
          nombre={confirm.nombre}
          loading={removing}
          onConfirm={handleConfirmRemove}
          onCancel={() => setConfirm(null)}
        />
      )}
      {piId && onRefresh && (
        showForm ? (
          <AddPersonaForm
            horasPorPersona={horasPorPersona}
            onDone={() => { setShowForm(false); onRefresh() }}
            onCancel={() => setShowForm(false)}
            onSubmit={handleCrear}
          />
        ) : (
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 rounded-md border border-allianz-blue/30 bg-blue-50 px-3 py-1.5 text-xs font-medium text-allianz-blue hover:bg-blue-100"
              >
                <UserPlus size={14} /> Agregar persona
              </button>
              <button
                onClick={handleSincronizar}
                disabled={syncing}
                className="flex items-center gap-1.5 rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 disabled:opacity-40"
                title={`Resetear capacidad de todas las personas a ${horasPorPersona}h (valor del PI)`}
              >
                <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
                {syncing ? 'Sincronizando…' : `Sincronizar capacidad (${horasPorPersona}h)`}
              </button>
            </div>
            {syncMsg && (
              <p className={clsx('flex items-center gap-1 text-xs font-medium', syncMsg.ok ? 'text-green-700' : 'text-red-600')}>
                {syncMsg.ok ? <Check size={13} /> : <X size={13} />} {syncMsg.text}
              </p>
            )}
          </div>
        )
      )}

      <CapacitySummary personas={personas} />

      <NovedadesPanel piId={piId} personas={personas} onRefresh={onRefresh} />

      <DataPanel>
        <div className="space-y-3 p-3">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-md border border-corporate-line bg-white px-2 py-1.5">
              <Search size={14} className="shrink-0 text-corporate-muted" />
              <input
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar por nombre, tecnología o estado"
                className="min-w-0 flex-1 bg-transparent text-xs text-corporate-ink placeholder:text-corporate-muted focus:outline-none"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setVista('riesgo')}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium',
                  vista === 'riesgo'
                    ? 'border-allianz-blue bg-blue-50 text-allianz-blue'
                    : 'border-corporate-line bg-white text-corporate-muted hover:text-corporate-ink',
                )}
              >
                <ListFilter size={13} /> Riesgo
              </button>
              <button
                type="button"
                onClick={() => setVista('tecnologia')}
                className={clsx(
                  'inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-xs font-medium',
                  vista === 'tecnologia'
                    ? 'border-allianz-blue bg-blue-50 text-allianz-blue'
                    : 'border-corporate-line bg-white text-corporate-muted hover:text-corporate-ink',
                )}
              >
                <Layers size={13} /> Tecnología
              </button>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {FILTERS.map(item => (
              <FilterButton
                key={item.id}
                active={filtro === item.id}
                label={item.label}
                onClick={() => setFiltro(item.id)}
              />
            ))}
          </div>
          <p className="text-xs text-corporate-muted">
            {filtered.length}/{personas.length} personas · ordenado por estado, disponibilidad y ocupación.
          </p>
        </div>
      </DataPanel>

      {vista === 'riesgo' ? (
        <CapacityTable
          title="Capacidad por riesgo"
          description={`${filtered.length} persona${filtered.length !== 1 ? 's' : ''} priorizadas por sobrecarga y disponibilidad`}
          rows={filtered}
          piId={piId}
          onRefresh={onRefresh}
          horasPorPersona={horasPorPersona}
          onRemove={p => setConfirm({ id: p.id, nombre: p.nombre })}
          onAdd={() => setShowForm(true)}
          pi={pi}
          expandedId={expandedId}
          onToggleExpand={toggleExpand}
        />
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          <CapacityTable
            title="Equipo COBOL"
            description={`${cobol.length} persona${cobol.length !== 1 ? 's' : ''}`}
            rows={cobol}
            piId={piId}
            onRefresh={onRefresh}
            horasPorPersona={horasPorPersona}
            onRemove={p => setConfirm({ id: p.id, nombre: p.nombre })}
            onAdd={() => setShowForm(true)}
            pi={pi}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
          />
          <CapacityTable
            title="Equipo JAVA"
            description={`${java.length} persona${java.length !== 1 ? 's' : ''}`}
            rows={java}
            piId={piId}
            onRefresh={onRefresh}
            horasPorPersona={horasPorPersona}
            onRemove={p => setConfirm({ id: p.id, nombre: p.nombre })}
            onAdd={() => setShowForm(true)}
            pi={pi}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
          />
          <CapacityTable
            title="Calidad"
            description={`${calidad.length} persona${calidad.length !== 1 ? 's' : ''}`}
            rows={calidad}
            piId={piId}
            onRefresh={onRefresh}
            horasPorPersona={horasPorPersona}
            onRemove={p => setConfirm({ id: p.id, nombre: p.nombre })}
            onAdd={() => setShowForm(true)}
            pi={pi}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
          />
          <CapacityTable
            title="Gestión"
            description={`${gestion.length} persona${gestion.length !== 1 ? 's' : ''}`}
            rows={gestion}
            piId={piId}
            onRefresh={onRefresh}
            horasPorPersona={horasPorPersona}
            onRemove={p => setConfirm({ id: p.id, nombre: p.nombre })}
            onAdd={() => setShowForm(true)}
            pi={pi}
            expandedId={expandedId}
            onToggleExpand={toggleExpand}
          />
        </div>
      )}
    </div>
  )
}
