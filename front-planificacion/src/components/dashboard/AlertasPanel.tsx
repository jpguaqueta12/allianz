import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, CalendarDays, CheckCircle2, Clock, Loader2, RefreshCw, UserX, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { AlertaItem, AlertaSinAsignacionItem } from '../../types'
import {
  getAlertas,
  getAlertasSinAsignacion,
  updateFechaAsignacion,
  updateFechaComprometidaCliente,
  updateFechaFinalizacion,
} from '../../services/api'

// ── helpers de presentación ───────────────────────────────────────────────────

type Nivel = 'verde' | 'amarilla' | 'roja'

const NIVEL_META: Record<Nivel, { label: string; icon: React.ReactNode; row: string; badge: string }> = {
  verde:    { label: 'En tiempo',   icon: <CheckCircle2 size={13} />,  row: '',                    badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  amarilla: { label: 'Por vencer',  icon: <Clock size={13} />,         row: 'bg-amber-50/60',      badge: 'bg-amber-50 text-amber-700 border-amber-200' },
  roja:     { label: 'Vencida',     icon: <XCircle size={13} />,       row: 'bg-red-50/60',        badge: 'bg-red-50 text-red-700 border-red-200' },
}

function NivelBadge({ nivel }: { nivel: Nivel | null }) {
  if (!nivel) return <span className="text-corporate-muted text-xs">—</span>
  const m = NIVEL_META[nivel]
  return (
    <span className={clsx(
      'inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold',
      m.badge,
    )}>
      {m.icon}{m.label}
    </span>
  )
}

// ── tarjetas resumen ──────────────────────────────────────────────────────────

function SummaryGroup({ title, items, field }: {
  title: string
  items: AlertaItem[]
  field: 'alerta_desarrollo' | 'alerta_qa'
}) {
  const count = (n: Nivel) => items.filter(i => i[field] === n).length
  const verde    = count('verde')
  const amarilla = count('amarilla')
  const roja     = count('roja')

  return (
    <div className="flex-1 min-w-[200px] rounded-xl border border-corporate-line bg-white p-4">
      <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-corporate-muted">{title}</p>
      <div className="flex gap-3">
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-emerald-600">{verde}</span>
          <span className="text-[10px] text-emerald-600 mt-0.5">En tiempo</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-amber-500">{amarilla}</span>
          <span className="text-[10px] text-amber-500 mt-0.5">Por vencer</span>
        </div>
        <div className="flex flex-col items-center">
          <span className="text-2xl font-bold text-red-600">{roja}</span>
          <span className="text-[10px] text-red-600 mt-0.5">Vencidas</span>
        </div>
      </div>
      {(amarilla > 0 || roja > 0) && (
        <div className="mt-3 h-2 rounded-full overflow-hidden flex bg-corporate-surface">
          {verde    > 0 && <div className="bg-emerald-400 h-full transition-all" style={{ width: `${(verde    / (verde + amarilla + roja)) * 100}%` }} />}
          {amarilla > 0 && <div className="bg-amber-400  h-full transition-all" style={{ width: `${(amarilla / (verde + amarilla + roja)) * 100}%` }} />}
          {roja     > 0 && <div className="bg-red-400    h-full transition-all" style={{ width: `${(roja     / (verde + amarilla + roja)) * 100}%` }} />}
        </div>
      )}
    </div>
  )
}

// ── filtros ───────────────────────────────────────────────────────────────────

type Filtro = 'todos' | 'alertas' | 'amarilla' | 'roja'

const FILTROS: { id: Filtro; label: string }[] = [
  { id: 'todos',    label: 'Todos' },
  { id: 'alertas',  label: 'Con alerta' },
  { id: 'amarilla', label: 'Por vencer' },
  { id: 'roja',     label: 'Vencidas' },
]

function matchFiltro(item: AlertaItem, f: Filtro): boolean {
  if (f === 'todos') return true
  if (f === 'alertas') return item.alerta_desarrollo !== 'verde' || (item.alerta_qa != null && item.alerta_qa !== 'verde')
  if (f === 'amarilla') return item.alerta_desarrollo === 'amarilla' || item.alerta_qa === 'amarilla'
  if (f === 'roja') return item.alerta_desarrollo === 'roja' || item.alerta_qa === 'roja'
  return true
}

function isValidDate(v: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) && !isNaN(Date.parse(v))
}

function sortByCompromisoAsc(a: AlertaItem, b: AlertaItem): number {
  const aDate = a.fecha_comprometida_cliente ?? a.fecha_fin_desarrollo
  const bDate = b.fecha_comprometida_cliente ?? b.fecha_fin_desarrollo
  if (!aDate && !bDate) return (a.ticket_key ?? a.summary).localeCompare(b.ticket_key ?? b.summary)
  if (!aDate) return 1
  if (!bDate) return -1
  const dateCompare = aDate.localeCompare(bDate)
  if (dateCompare !== 0) return dateCompare
  return (a.ticket_key ?? a.summary).localeCompare(b.ticket_key ?? b.summary)
}

function AlertDateCell({
  value,
  placeholder = 'AAAA-MM-DD',
  iconClass,
  focusClass,
  onSave,
}: {
  value: string | null | undefined
  placeholder?: string
  iconClass: string
  focusClass: string
  onSave: (fecha: string | null) => Promise<void>
}) {
  const [saving, setSaving] = useState(false)
  const [localValue, setLocalValue] = useState(value ?? '')
  const valueRef = useRef(value ?? '')
  const savingRef = useRef(false)

  useEffect(() => {
    if (savingRef.current) return
    const v = value ?? ''
    setLocalValue(v)
    valueRef.current = v
  }, [value])

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setLocalValue(e.target.value)
    valueRef.current = e.target.value
  }

  async function commit() {
    const trimmed = valueRef.current.trim()
    const current = value ?? ''
    if (trimmed === current) return

    if (trimmed && !isValidDate(trimmed)) {
      setLocalValue(current)
      valueRef.current = current
      return
    }

    savingRef.current = true
    setSaving(true)
    try {
      await onSave(trimmed || null)
    } catch {
      setLocalValue(current)
      valueRef.current = current
    } finally {
      savingRef.current = false
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 px-1">
      <CalendarDays size={12} className={clsx('shrink-0', localValue ? iconClass : 'text-corporate-muted')} />
      <input
        type="text"
        value={localValue}
        placeholder={placeholder}
        onChange={handleChange}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); commit() } }}
        disabled={saving}
        className={clsx(
          'w-24 rounded border border-transparent bg-transparent px-1 py-0.5 text-xs text-corporate-ink placeholder-corporate-muted focus:bg-white focus:outline-none disabled:opacity-50',
          focusClass,
        )}
      />
      {saving && <Loader2 size={12} className={clsx('animate-spin shrink-0', iconClass)} />}
    </div>
  )
}

// ── tabla sin asignación ──────────────────────────────────────────────────────

function TablaSinAsignacion({ items, loading, loaded }: {
  items: AlertaSinAsignacionItem[]
  loading: boolean
  loaded: boolean
}) {
  if (!loaded && loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-allianz-blue" />
    </div>
  )

  return items.length === 0 ? (
    <div className="rounded-xl border border-corporate-line bg-white py-16 text-center text-sm text-corporate-muted">
      {loaded ? 'No hay tickets pendientes de asignación de personal' : 'Cargando…'}
    </div>
  ) : (
    <div className="overflow-hidden rounded-xl border border-orange-200 shadow-sm">
      <div className="overflow-x-auto">
        <table className="w-full min-w-[700px] table-auto text-xs border-collapse">
          <thead>
            <tr className="bg-orange-600 text-white">
              <th className="min-w-[100px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Key</th>
              <th className="px-3 py-3 text-left font-semibold border-r border-white/10">Summary</th>
              <th className="min-w-[150px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Equipo asignado</th>
              <th className="min-w-[130px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Assignee</th>
              <th className="min-w-[110px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Asignación</th>
              <th className="min-w-[130px] px-3 py-3 text-center font-semibold whitespace-nowrap">Estado</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item, idx) => (
              <tr key={item.id}
                className={clsx(
                  'border-b border-orange-100 transition-colors bg-orange-50/40',
                  idx % 2 === 0 ? 'bg-orange-50/30' : 'bg-white',
                )}
              >
                <td className="px-3 py-2 border-r border-orange-100">
                  <span className="font-mono font-semibold text-allianz-blue whitespace-nowrap">
                    {item.ticket_key ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-orange-100">
                  <span className="line-clamp-2 text-corporate-ink leading-snug" title={item.summary}>
                    {item.summary}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-orange-100">
                  <span className="line-clamp-2 font-medium text-corporate-ink leading-snug">
                    {item.equipo ?? '—'}
                  </span>
                </td>
                <td className="px-3 py-2 border-r border-orange-100 text-corporate-muted">
                  {item.assignee ?? '—'}
                </td>
                <td className="px-3 py-2 border-r border-orange-100 whitespace-nowrap text-corporate-muted">
                  {item.fecha_asignacion ?? '—'}
                </td>
                <td className="px-3 py-2 text-center">
                  <span className="inline-flex items-center gap-1 rounded border px-2 py-0.5 text-[11px] font-semibold bg-orange-50 text-orange-700 border-orange-300">
                    <UserX size={11} /> Requiere asignación
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── panel principal ───────────────────────────────────────────────────────────

type Vista = 'compromiso' | 'sin_asignacion'

interface Props {
  modulo: 'MEJORA_CONTINUA' | 'FABRICA'
  active: boolean
  piId?: number | null
}

export function AlertasPanel({ modulo, active, piId }: Props) {
  const [items, setItems]     = useState<AlertaItem[]>([])
  const [sinAsig, setSinAsig] = useState<AlertaSinAsignacionItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [filtro, setFiltro]   = useState<Filtro>('todos')
  const [loaded, setLoaded]   = useState(false)
  const [vista, setVista]     = useState<Vista>('compromiso')

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const [data, sinData] = await Promise.all([
        getAlertas(modulo, piId),
        getAlertasSinAsignacion(modulo, piId),
      ])
      setItems(data)
      setSinAsig(sinData)
      setLoaded(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    setLoaded(false)
    setItems([])
    setSinAsig([])
  }, [modulo, piId])

  useEffect(() => {
    if (active && !loaded) load()
  }, [active, loaded, modulo, piId])

  if (!loaded && loading) return (
    <div className="flex items-center justify-center py-20">
      <div className="animate-spin rounded-full h-7 w-7 border-b-2 border-allianz-blue" />
    </div>
  )

  if (error) return (
    <div className="flex items-center justify-center py-20 text-red-600 text-sm gap-2">
      <AlertTriangle size={16} /> {error}
    </div>
  )

  const devItems = items.filter(i => i.alerta_desarrollo != null)
  const visible  = items.filter(i => matchFiltro(i, filtro)).sort(sortByCompromisoAsc)
  const equipoAsignado = (item: AlertaItem) =>
    item.equipo ?? (item as AlertaItem & { assigned_team?: string | null }).assigned_team ?? null
  const equipoTrabajo = (item: AlertaItem) =>
    item.equipo_trabajo ?? (item as AlertaItem & { equipo_trabajo?: string | null }).equipo_trabajo ?? null

  async function saveFechaAsignacion(item: AlertaItem, fecha: string | null) {
    const res = await updateFechaAsignacion(modulo, item.id, fecha)
    setItems(prev => prev.map(it => it.id === item.id ? {
      ...it,
      fecha_asignacion: fecha,
      fecha_fin_real: res.fecha_finalizacion,
      fecha_fin_qa: res.fecha_finalizacion,
      fecha_comprometida_cliente: res.fecha_finalizacion_inicial ?? it.fecha_comprometida_cliente,
      fecha_fin_desarrollo: res.fecha_finalizacion_inicial ?? it.fecha_fin_desarrollo,
    } : it))
    await load()
  }

  async function saveFechaComprometidaCliente(item: AlertaItem, fecha: string | null) {
    const res = await updateFechaComprometidaCliente(modulo, item.id, fecha)
    setItems(prev => prev.map(it => it.id === item.id ? {
      ...it,
      fecha_comprometida_cliente: res.fecha_finalizacion_inicial,
      fecha_fin_desarrollo: res.fecha_finalizacion_inicial,
    } : it))
    await load()
  }

  async function saveFechaFinalizacion(item: AlertaItem, fecha: string | null) {
    const res = await updateFechaFinalizacion(modulo, item.id, fecha)
    setItems(prev => prev.map(it => it.id === item.id ? {
      ...it,
      fecha_fin_real: res.fecha_finalizacion,
      fecha_fin_qa: res.fecha_finalizacion,
    } : it))
    await load()
  }

  const rowClass = (item: AlertaItem) => {
    const worstDev = item.alerta_desarrollo
    const worstQa  = item.alerta_qa
    const worst    = worstQa === 'roja' || worstDev === 'roja'
      ? 'roja' : worstQa === 'amarilla' || worstDev === 'amarilla'
      ? 'amarilla' : 'verde'
    return NIVEL_META[worst].row
  }

  return (
    <div className="space-y-4">
      {/* pestañas de vista */}
      <div className="flex gap-2 border-b border-corporate-line pb-0">
        <button
          onClick={() => setVista('compromiso')}
          className={clsx(
            'px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px',
            vista === 'compromiso'
              ? 'border-allianz-blue text-allianz-blue'
              : 'border-transparent text-corporate-muted hover:text-corporate-ink',
          )}
        >
          Compromiso cliente
        </button>
        <button
          onClick={() => setVista('sin_asignacion')}
          className={clsx(
            'px-4 py-2 text-xs font-semibold border-b-2 transition-colors -mb-px flex items-center gap-1.5',
            vista === 'sin_asignacion'
              ? 'border-orange-500 text-orange-600'
              : 'border-transparent text-corporate-muted hover:text-corporate-ink',
          )}
        >
          <UserX size={12} />
          Sin asignación de personal
          {sinAsig.length > 0 && (
            <span className={clsx(
              'ml-1 rounded-full px-1.5 py-0.5 text-[10px] font-bold',
              vista === 'sin_asignacion' ? 'bg-orange-100 text-orange-700' : 'bg-orange-500 text-white',
            )}>
              {sinAsig.length}
            </span>
          )}
        </button>
      </div>

      {vista === 'sin_asignacion' ? (
        <>
          <div className="flex justify-between items-center">
            <p className="text-xs text-corporate-muted">
              Tickets asignados al equipo pero sin personal de desarrollo designado en el plan.
            </p>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-corporate-line bg-white px-3 py-1.5 text-xs text-corporate-muted hover:text-corporate-ink"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>
          <TablaSinAsignacion items={sinAsig} loading={loading} loaded={loaded} />
        </>
      ) : (
        <>
          {/* resumen */}
          <div className="flex flex-wrap gap-3">
            <SummaryGroup title="Alertas — Compromiso cliente" items={devItems} field="alerta_desarrollo" />
          </div>

          {/* filtros + refresh */}
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex gap-1">
              {FILTROS.map(f => (
                <button
                  key={f.id}
                  onClick={() => setFiltro(f.id)}
                  className={clsx(
                    'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
                    filtro === f.id
                      ? 'border-allianz-blue bg-allianz-blue text-white'
                      : 'border-corporate-line bg-white text-corporate-muted hover:text-corporate-ink',
                  )}
                >
                  {f.label}
                  {f.id !== 'todos' && (
                    <span className="ml-1.5 opacity-70">
                      {f.id === 'alertas'
                        ? items.filter(i => matchFiltro(i, 'alertas')).length
                        : f.id === 'amarilla'
                        ? items.filter(i => matchFiltro(i, 'amarilla')).length
                        : items.filter(i => matchFiltro(i, 'roja')).length}
                    </span>
                  )}
                </button>
              ))}
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-lg border border-corporate-line bg-white px-3 py-1.5 text-xs text-corporate-muted hover:text-corporate-ink"
            >
              <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </div>

          {/* tabla */}
          {visible.length === 0 ? (
            <div className="rounded-xl border border-corporate-line bg-white py-16 text-center text-sm text-corporate-muted">
              {loaded ? 'No hay tickets con alertas activas en el filtro seleccionado' : 'Cargando…'}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-corporate-line shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1080px] table-auto text-xs border-collapse">
                  <thead>
                    <tr className="bg-slate-800 text-white">
                      <th className="min-w-[100px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Key</th>
                      <th className="px-3 py-3 text-left font-semibold border-r border-white/10">Summary</th>
                      <th className="min-w-[150px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Equipo asignado</th>
                      <th className="min-w-[100px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Inicio</th>
                      <th className="min-w-[150px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Compromiso cliente</th>
                      <th className="min-w-[110px] px-3 py-3 text-center font-semibold whitespace-nowrap border-r border-white/10">Alerta</th>
                      <th className="min-w-[110px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Fin Real</th>
                      <th className="min-w-[110px] px-3 py-3 text-right font-semibold whitespace-nowrap border-r border-white/10">Desviación</th>
                      <th className="min-w-[170px] px-3 py-3 text-right font-semibold whitespace-nowrap border-r border-white/10">Horas (J / C / G / Cal)</th>
                      <th className="min-w-[180px] px-3 py-3 text-left font-semibold whitespace-nowrap">Equipo trabajo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {visible.map((item, idx) => {
                      const isEven = idx % 2 === 0
                      const extra = rowClass(item)
                      return (
                        <tr key={item.id}
                          className={clsx(
                            'border-b border-corporate-line transition-colors',
                            extra || (isEven ? 'bg-white' : 'bg-slate-50/60'),
                          )}
                        >
                          <td className="px-3 py-2 border-r border-corporate-line/30">
                            <span className="font-mono font-semibold text-allianz-blue whitespace-nowrap">
                              {item.ticket_key ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-r border-corporate-line/30">
                            <span className="line-clamp-2 text-corporate-ink leading-snug" title={item.summary}>
                              {item.summary}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-r border-corporate-line/30">
                            <span className="line-clamp-2 font-medium text-corporate-ink leading-snug" title={equipoAsignado(item) ?? ''}>
                              {equipoAsignado(item) ?? '—'}
                            </span>
                          </td>
                          <td className="px-3 py-2 border-r border-corporate-line/30 whitespace-nowrap text-corporate-muted">
                            <AlertDateCell
                              value={item.fecha_asignacion}
                              iconClass="text-allianz-blue"
                              focusClass="focus:border-allianz-blue"
                              onSave={fecha => saveFechaAsignacion(item, fecha)}
                            />
                          </td>
                          <td className="px-3 py-2 border-r border-corporate-line/30 whitespace-nowrap font-medium">
                            <AlertDateCell
                              value={item.fecha_comprometida_cliente ?? item.fecha_fin_desarrollo}
                              iconClass="text-gray-500"
                              focusClass="focus:border-gray-400"
                              onSave={fecha => saveFechaComprometidaCliente(item, fecha)}
                            />
                          </td>
                          <td className="px-3 py-2 border-r border-corporate-line/30 text-center">
                            <NivelBadge nivel={item.alerta_desarrollo} />
                          </td>
                          <td className="px-3 py-2 border-r border-corporate-line/30 whitespace-nowrap text-corporate-muted">
                            <AlertDateCell
                              value={item.fecha_fin_real ?? item.fecha_fin_qa}
                              iconClass="text-emerald-600"
                              focusClass="focus:border-emerald-500"
                              onSave={fecha => saveFechaFinalizacion(item, fecha)}
                            />
                          </td>
                          <td className={clsx('px-3 py-2 border-r border-corporate-line/30 text-right font-mono text-[11px]', (item.dias_desviacion ?? 0) > 0 ? 'font-semibold text-red-700' : 'text-corporate-muted')}>
                            {item.dias_desviacion != null ? `${item.dias_desviacion}d` : item.dias_para_compromiso != null ? `${item.dias_para_compromiso}d` : '—'}
                          </td>
                          <td className="px-3 py-2 text-right font-mono text-[11px] whitespace-nowrap text-corporate-muted border-r border-corporate-line/30">
                            {item.java_horas > 0 && <span className="text-blue-600">J:{item.java_horas}h</span>}
                            {item.java_horas > 0 && item.cobol_horas > 0 && ' '}
                            {item.cobol_horas > 0 && <span className="text-emerald-600">C:{item.cobol_horas}h</span>}
                            {(item.java_horas > 0 || item.cobol_horas > 0) && (item.gestion_horas ?? 0) > 0 && ' '}
                            {(item.gestion_horas ?? 0) > 0 && <span className="text-amber-600">G:{item.gestion_horas}h</span>}
                            {(item.java_horas > 0 || item.cobol_horas > 0 || (item.gestion_horas ?? 0) > 0) && (item.calidad_horas ?? item.qa_horas) > 0 && ' '}
                            {(item.calidad_horas ?? item.qa_horas) > 0 && <span className="text-rose-600">Cal:{item.calidad_horas ?? item.qa_horas}h</span>}
                          </td>
                          <td className="px-3 py-2">
                            <span className="line-clamp-2 text-corporate-ink leading-snug" title={equipoTrabajo(item) ?? ''}>
                              {equipoTrabajo(item) ?? '—'}
                            </span>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
