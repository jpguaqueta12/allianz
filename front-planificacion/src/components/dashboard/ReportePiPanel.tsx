import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, BarChart3, CalendarClock, CheckCircle2, Clock3,
  Copy, Download, FileText, Filter, Gauge, GitBranch, Loader2,
  PieChart, RefreshCw, Target, TrendingUp, X,
} from 'lucide-react'
import clsx from 'clsx'
import { BacklogItem, PersonaCapacidad, PiInfo } from '../../types'
import { getBacklog } from '../../services/api'
import { DataPanel, KpiCard, StatusBadge } from '../ui/Corporate'

interface Props {
  modulo: 'MEJORA_CONTINUA' | 'FABRICA'
  piId?: number | null
  piActivo?: PiInfo | null
  active: boolean
  capacidad: PersonaCapacidad[]
}

type Tone = 'blue' | 'red' | 'green' | 'amber' | 'neutral' | 'purple'
type DrillFilter =
  | { type: 'all'; label: string }
  | { type: 'vencidos'; label: string }
  | { type: 'escalados'; label: string }
  | { type: 'finalizados'; label: string }
  | { type: 'sin_asignacion'; label: string }
  | { type: 'sin_planificacion'; label: string }
  | { type: 'sin_finalizacion'; label: string }
  | { type: 'siguiente_pi'; label: string }
  | { type: 'status'; label: string; value: string }
  | { type: 'issue_type'; label: string; value: string }
  | { type: 'technology'; label: string; value: string }

function isFinalizado(status: string | null) {
  return ['finalizado', 'finalizada', 'done', 'closed', 'cerrado', 'cerrada', 'resuelto', 'resolved']
    .includes((status ?? '').trim().toLowerCase())
}

function parseDate(value: string | null) {
  if (!value) return null
  const d = new Date(value + 'T12:00:00')
  return Number.isNaN(d.getTime()) ? null : d
}

function todayIso() {
  return new Date().toISOString().split('T')[0]
}

function daysBetween(from: Date, to: Date) {
  return Math.round((to.getTime() - from.getTime()) / 86400000)
}

function hoursByTech(item: BacklogItem) {
  const result = { java: 0, cobol: 0, gestion: 0, calidad: 0 }
  if (item.planificacion_items?.length) {
    item.planificacion_items.forEach(row => {
      result[row.perfil] += row.horas ?? 0
    })
    return result
  }
  result.java = (item.horas_analisis_java ?? 0) + (item.horas_desarrollo_java ?? 0) + (item.horas_pruebas_java ?? 0) + (item.horas_af_java ?? 0)
  result.cobol = (item.horas_analisis_cobol ?? 0) + (item.horas_desarrollo_cobol ?? 0) + (item.horas_pruebas_cobol ?? 0) + (item.horas_af_cobol ?? 0)
  result.gestion = (item.horas_analisis_dialogue ?? 0) + (item.horas_desarrollo_dialogue ?? 0) + (item.horas_pruebas_dialogue ?? 0) + (item.horas_af_dialogue ?? 0)
    + (item.horas_analisis_parametria ?? 0) + (item.horas_desarrollo_parametria ?? 0) + (item.horas_pruebas_parametria ?? 0) + (item.horas_af_parametria ?? 0)
  result.calidad = (item.horas_analisis_qa ?? 0) + (item.horas_af_qa ?? 0)
  return result
}

function hasTechnology(item: BacklogItem, tech: string) {
  const hours = hoursByTech(item)
  return (hours[tech.toLowerCase() as keyof ReturnType<typeof hoursByTech>] ?? 0) > 0
}

function groupCount(rows: BacklogItem[], getter: (item: BacklogItem) => string | null | undefined) {
  const map = new Map<string, number>()
  rows.forEach(item => {
    const key = getter(item) || 'Sin dato'
    map.set(key, (map.get(key) ?? 0) + 1)
  })
  return Array.from(map, ([label, value]) => ({ label, value }))
    .sort((a, b) => b.value - a.value || a.label.localeCompare(b.label))
}

function ticketResponsible(item: BacklogItem) {
  const fromPlan = item.planificacion_items
    ?.map(row => row.responsable)
    .filter(Boolean) as string[] | undefined
  const responsables = fromPlan?.length
    ? fromPlan
    : [item.responsable_java, item.responsable_cobol, item.responsable_dialogue, item.responsable_parametria, item.responsable_qa].filter(Boolean) as string[]
  return Array.from(new Set(responsables)).join(', ') || item.assignee || ''
}

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function etcHorasReales(etc: number | null | undefined, piActivo?: PiInfo | null) {
  const dias = etc ?? 0
  if (dias <= 0) return 0
  const horasPorDia = piActivo?.horas_por_dia && piActivo.horas_por_dia > 0 ? piActivo.horas_por_dia : 8
  return dias * horasPorDia
}

function formatEtc(etc: number | null | undefined, piActivo?: PiInfo | null) {
  const dias = etc ?? 0
  if (dias <= 0) return ''
  return `${dias}d / ${etcHorasReales(dias, piActivo)}h reales`
}

function downloadCsv(filename: string, rows: BacklogItem[], piActivo?: PiInfo | null) {
  const headers = [
    'ticket_key', 'summary', 'status', 'issue_type', 'assignee', 'responsables',
    'total_horas', 'fecha_asignacion', 'fecha_finalizacion', 'fecha_entrega',
    'fecha_escalado', 'fecha_reinicio', 'etc_dias_horas',
  ]
  const body = rows.map(item => [
    item.ticket_key, item.summary, item.status, item.issue_type, item.assignee, ticketResponsible(item),
    item.total_horas, item.fecha_asignacion, item.fecha_finalizacion, item.fecha_entrega,
    item.fecha_escalado, item.fecha_reinicio, formatEtc(item.etc, piActivo),
  ].map(csvCell).join(','))
  const csv = [headers.map(csvCell).join(','), ...body].join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function ChartPanel({
  title,
  rows,
  tone = 'blue',
  onSelect,
}: {
  title: string
  rows: { label: string; value: number }[]
  tone?: Tone
  onSelect?: (label: string) => void
}) {
  const max = Math.max(...rows.map(r => r.value), 1)
  const barClass: Record<Tone, string> = {
    blue: 'bg-allianz-blue',
    red: 'bg-red-500',
    green: 'bg-green-500',
    amber: 'bg-amber-500',
    neutral: 'bg-slate-400',
    purple: 'bg-violet-500',
  }
  return (
    <DataPanel title={title} icon={BarChart3}>
      <div className="space-y-3 p-4">
        {rows.length === 0 ? (
          <p className="py-6 text-center text-xs text-corporate-muted">Sin datos para graficar.</p>
        ) : rows.map(row => (
          <button
            key={row.label}
            type="button"
            onClick={() => onSelect?.(row.label)}
            className={clsx(
              'grid w-full grid-cols-[minmax(90px,160px)_1fr_44px] items-center gap-3 rounded px-1 py-0.5 text-left',
              onSelect && 'hover:bg-corporate-surface',
            )}
          >
            <span className="truncate text-xs font-medium text-corporate-ink" title={row.label}>{row.label}</span>
            <div className="h-2 rounded-full bg-corporate-surface">
              <div className={clsx('h-2 rounded-full', barClass[tone])} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-mono text-xs text-corporate-muted">{row.value}</span>
          </button>
        ))}
      </div>
    </DataPanel>
  )
}

function SegmentedBar({
  title,
  segments,
}: {
  title: string
  segments: { label: string; value: number; className: string }[]
}) {
  const total = segments.reduce((sum, item) => sum + item.value, 0)
  return (
    <DataPanel title={title} icon={PieChart}>
      <div className="space-y-3 p-4">
        <div className="flex h-4 overflow-hidden rounded-full bg-corporate-surface">
          {segments.filter(s => s.value > 0).map(segment => (
            <div
              key={segment.label}
              className={segment.className}
              style={{ width: `${(segment.value / Math.max(total, 1)) * 100}%` }}
              title={`${segment.label}: ${segment.value}`}
            />
          ))}
        </div>
        <div className="grid gap-2 sm:grid-cols-2">
          {segments.map(segment => (
            <div key={segment.label} className="flex items-center justify-between gap-3 rounded border border-corporate-line bg-white px-3 py-2">
              <span className="flex items-center gap-2 text-xs text-corporate-muted">
                <span className={clsx('h-2.5 w-2.5 rounded-full', segment.className)} />
                {segment.label}
              </span>
              <span className="font-mono text-xs font-semibold text-corporate-ink">{segment.value}</span>
            </div>
          ))}
        </div>
      </div>
    </DataPanel>
  )
}

function RiskList({
  title,
  rows,
  empty,
  onOpen,
}: {
  title: string
  rows: BacklogItem[]
  empty: string
  onOpen?: () => void
}) {
  return (
    <DataPanel
      title={title}
      icon={AlertTriangle}
      action={rows.length > 0 && onOpen ? (
        <button type="button" onClick={onOpen} className="text-xs font-medium text-allianz-blue hover:text-blue-700">
          Ver todos
        </button>
      ) : null}
    >
      <div className="divide-y divide-corporate-line">
        {rows.length === 0 ? (
          <p className="p-4 text-xs text-corporate-muted">{empty}</p>
        ) : rows.slice(0, 8).map(item => (
          <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <p className="font-mono text-xs font-semibold text-allianz-blue">{item.ticket_key ?? `#${item.id}`}</p>
              <p className="mt-0.5 line-clamp-2 text-xs text-corporate-ink" title={item.summary}>{item.summary}</p>
            </div>
            <div className="shrink-0 text-right">
              <StatusBadge tone={item.fecha_finalizacion ? 'red' : 'amber'}>{item.status ?? 'Sin status'}</StatusBadge>
              <p className="mt-1 font-mono text-[11px] text-corporate-muted">{item.fecha_finalizacion ?? 'Sin fin'}</p>
            </div>
          </div>
        ))}
      </div>
    </DataPanel>
  )
}

function KpiAction({
  label,
  value,
  detail,
  icon: Icon,
  tone = 'neutral',
  onClick,
}: {
  label: string
  value: string | number
  detail?: string
  icon: typeof FileText
  tone?: Exclude<Tone, 'purple'>
  onClick: () => void
}) {
  const toneClass = {
    blue: 'text-allianz-blue bg-blue-50 border-blue-100',
    red: 'text-red-700 bg-red-50 border-red-100',
    green: 'text-green-700 bg-green-50 border-green-100',
    amber: 'text-amber-700 bg-amber-50 border-amber-100',
    neutral: 'text-corporate-muted bg-corporate-surface border-corporate-line',
  }
  return (
    <button type="button" onClick={onClick} className="corporate-panel px-4 py-3 text-left transition-colors hover:border-allianz-blue/40 hover:bg-blue-50/30">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase text-corporate-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-corporate-ink">{value}</p>
          {detail && <p className="mt-1 text-xs text-corporate-muted">{detail}</p>}
        </div>
        <div className={clsx('flex h-9 w-9 items-center justify-center rounded-md border', toneClass[tone])}>
          <Icon size={18} />
        </div>
      </div>
    </button>
  )
}

function DetailTable({ rows, piActivo }: { rows: BacklogItem[]; piActivo?: PiInfo | null }) {
  return (
    <DataPanel title="Detalle filtrado" description={`${rows.length} ticket${rows.length !== 1 ? 's' : ''}`}>
      <div className="overflow-x-auto">
        <table className="corporate-table">
          <thead>
            <tr>
              {['Key', 'Status', 'Responsables', 'Horas', 'F. fin', 'Entrega', 'Escalado', 'ETC'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={8} className="px-3 py-6 text-center text-xs text-corporate-muted">Sin tickets para el filtro actual.</td></tr>
            ) : rows.slice(0, 40).map(item => (
              <tr key={item.id} className="hover:bg-corporate-surface">
                <td>
                  <p className="font-mono text-xs font-semibold text-allianz-blue">{item.ticket_key ?? `#${item.id}`}</p>
                  <p className="mt-0.5 line-clamp-1 max-w-[280px] text-[11px] text-corporate-muted" title={item.summary}>{item.summary}</p>
                </td>
                <td><StatusBadge>{item.status ?? 'Sin status'}</StatusBadge></td>
                <td className="max-w-[220px] truncate text-xs" title={ticketResponsible(item)}>{ticketResponsible(item) || '—'}</td>
                <td className="text-right font-mono">{item.total_horas ?? '—'}</td>
                <td className="font-mono text-xs">{item.fecha_finalizacion ?? '—'}</td>
                <td className="font-mono text-xs">{item.fecha_entrega ?? '—'}</td>
                <td className="font-mono text-xs">{item.fecha_escalado ?? '—'}</td>
                <td className="text-right font-mono">{formatEtc(item.etc, piActivo) || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataPanel>
  )
}

export function ReportePiPanel({ modulo, piId, piActivo, active, capacidad }: Props) {
  const [items, setItems] = useState<BacklogItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<DrillFilter>({ type: 'all', label: 'Todos los tickets' })
  const [copied, setCopied] = useState(false)
  const key = `${modulo}:${piId ?? 'activo'}`

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getBacklog(modulo, piId)
      setItems(data)
      setLoadedKey(key)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando reporte')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (active && loadedKey !== key) load()
  }, [active, key, loadedKey])

  const report = useMemo(() => {
    const today = parseDate(todayIso())!
    const total = items.length
    const planificados = items.filter(item => (item.total_horas ?? 0) > 0)
    const finalizados = items.filter(item => item.fecha_entrega || isFinalizado(item.status))
    const vencidos = items
      .filter(item => {
        const fin = parseDate(item.fecha_finalizacion)
        return fin && fin < today && !item.fecha_entrega && !isFinalizado(item.status)
      })
      .sort((a, b) => daysBetween(parseDate(a.fecha_finalizacion)!, today) < daysBetween(parseDate(b.fecha_finalizacion)!, today) ? 1 : -1)
    const escaladosActivos = items.filter(item => item.fecha_escalado && !item.fecha_reinicio)
    const sinAsignacion = items.filter(item => !item.fecha_asignacion)
    const sinPlanificacion = items.filter(item => (item.total_horas ?? 0) <= 0)
    const sinFinalizacion = items.filter(item => (item.total_horas ?? 0) > 0 && !item.fecha_finalizacion)
    const siguientePi = items.filter(item => item.prn === 'Debe pasar al siguiente PI')
    const conEtc = items.filter(item => (item.etc ?? 0) > 0)
    const capacidadTotal = capacidad.reduce((sum, p) => sum + (p.capacidad ?? 0), 0)
    const cargaTotal = capacidad.reduce((sum, p) => sum + (p.carga_estimada ?? 0), 0)
    const horasTotal = items.reduce((sum, item) => sum + (item.total_horas ?? 0), 0)
    const techHours = items.reduce((acc, item) => {
      const current = hoursByTech(item)
      Object.entries(current).forEach(([key, value]) => {
        acc[key] = (acc[key] ?? 0) + value
      })
      return acc
    }, {} as Record<string, number>)

    const capacidadRestante = capacidadTotal - cargaTotal
    const horasSinPlanificar = sinPlanificacion.length
    const score = Math.max(0, Math.min(100,
      100
      - (total ? Math.round((vencidos.length / total) * 35) : 0)
      - (total ? Math.round((escaladosActivos.length / total) * 20) : 0)
      - (total ? Math.round((sinAsignacion.length / total) * 15) : 0)
      - (total ? Math.round((sinPlanificacion.length / total) * 15) : 0)
      - (capacidadRestante < 0 ? 15 : 0)
      - (total ? Math.round((siguientePi.length / total) * 10) : 0),
    ))
    const recomendaciones = [
      vencidos.length ? `Priorizar ${vencidos.length} ticket${vencidos.length !== 1 ? 's' : ''} vencido${vencidos.length !== 1 ? 's' : ''}.` : null,
      escaladosActivos.length ? `Cerrar o reiniciar ${escaladosActivos.length} escalamiento${escaladosActivos.length !== 1 ? 's' : ''} activo${escaladosActivos.length !== 1 ? 's' : ''}.` : null,
      sinAsignacion.length ? `Asignar fecha de inicio a ${sinAsignacion.length} ticket${sinAsignacion.length !== 1 ? 's' : ''}.` : null,
      sinPlanificacion.length ? `Completar estimación de ${sinPlanificacion.length} ticket${sinPlanificacion.length !== 1 ? 's' : ''} sin planificación.` : null,
      capacidadRestante < 0 ? `Resolver déficit de ${Math.round(Math.abs(capacidadRestante))}h frente a la capacidad disponible.` : null,
      siguientePi.length ? `Gestionar ${siguientePi.length} ticket${siguientePi.length !== 1 ? 's' : ''} que supera${siguientePi.length !== 1 ? 'n' : ''} la fecha fin del PI.` : null,
    ].filter(Boolean) as string[]

    return {
      total,
      planificados,
      finalizados,
      vencidos,
      escaladosActivos,
      sinAsignacion,
      sinPlanificacion,
      sinFinalizacion,
      conEtc,
      capacidadTotal,
      cargaTotal,
      capacidadRestante,
      horasTotal,
      porStatus: groupCount(items, item => item.status).slice(0, 8),
      porIssueType: groupCount(items, item => item.issue_type).slice(0, 8),
      techHours: Object.entries(techHours)
        .map(([label, value]) => ({ label: label.toUpperCase(), value: Math.round(value) }))
        .filter(item => item.value > 0)
        .sort((a, b) => b.value - a.value),
      ocupacionGlobal: capacidadTotal > 0 ? Math.round((cargaTotal / capacidadTotal) * 100) : 0,
      siguientePi,
      score,
      recomendaciones,
    }
  }, [items, capacidad])

  const detailRows = useMemo(() => {
    if (filter.type === 'all') return items
    if (filter.type === 'vencidos') return report.vencidos
    if (filter.type === 'escalados') return report.escaladosActivos
    if (filter.type === 'finalizados') return report.finalizados
    if (filter.type === 'sin_asignacion') return report.sinAsignacion
    if (filter.type === 'sin_planificacion') return report.sinPlanificacion
    if (filter.type === 'sin_finalizacion') return report.sinFinalizacion
    if (filter.type === 'siguiente_pi') return report.siguientePi
    if (filter.type === 'status') return items.filter(item => (item.status || 'Sin dato') === filter.value)
    if (filter.type === 'issue_type') return items.filter(item => (item.issue_type || 'Sin dato') === filter.value)
    if (filter.type === 'technology') return items.filter(item => hasTechnology(item, filter.value))
    return items
  }, [filter, items, report])

  const summaryText = [
    `Reporte ${modulo === 'FABRICA' ? 'Fábrica' : 'Mejora Continua'} (${todayIso()})`,
    `Tickets: ${report.total}`,
    `Salud PI: ${report.score}%`,
    `Vencidos: ${report.vencidos.length}`,
    `Escalados activos: ${report.escaladosActivos.length}`,
    `Finalizados: ${report.finalizados.length}`,
    `Siguiente PI: ${report.siguientePi.length}`,
    `Horas estimadas: ${Math.round(report.horasTotal)}h`,
    `Carga equipo: ${Math.round(report.cargaTotal)}h de ${Math.round(report.capacidadTotal)}h (${report.ocupacionGlobal}%)`,
    report.recomendaciones.length ? `Acciones: ${report.recomendaciones.join(' ')}` : 'Acciones: sin alertas críticas.',
  ].join('\n')

  async function copySummary() {
    await navigator.clipboard.writeText(summaryText)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  if (loading && items.length === 0) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-corporate-muted">
        <Loader2 size={20} className="animate-spin" /> Cargando reporte...
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertTriangle size={16} className="text-red-600" />
        <span className="text-sm text-red-700">{error}</span>
        <button onClick={load} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-800">
          <RefreshCw size={12} /> Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-corporate-ink">Reporte operativo del PI</p>
          <p className="text-xs text-corporate-muted">
            {modulo === 'FABRICA' ? 'Fábrica' : 'Mejora Continua'} · {report.total} tickets · {report.vencidos.length} vencidos · {report.escaladosActivos.length} escalados activos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={copySummary} className="corporate-button-secondary">
            <Copy size={14} /> {copied ? 'Copiado' : 'Copiar resumen'}
          </button>
          <button onClick={() => downloadCsv(`reporte-${modulo.toLowerCase()}-${todayIso()}.csv`, detailRows, piActivo)} className="corporate-button-secondary">
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={load} disabled={loading} className="corporate-button-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar reporte
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiAction label="Tickets PI" value={report.total} icon={FileText} tone="blue" detail={`${report.planificados.length} planificados`} onClick={() => setFilter({ type: 'all', label: 'Todos los tickets' })} />
        <KpiAction label="Vencidos" value={report.vencidos.length} icon={CalendarClock} tone={report.vencidos.length ? 'red' : 'green'} detail={`${report.sinFinalizacion.length} sin fecha final`} onClick={() => setFilter({ type: 'vencidos', label: 'Tickets vencidos' })} />
        <KpiAction label="Escalados activos" value={report.escaladosActivos.length} icon={GitBranch} tone={report.escaladosActivos.length ? 'amber' : 'neutral'} detail={`${report.conEtc.length} con ETC`} onClick={() => setFilter({ type: 'escalados', label: 'Escalados activos' })} />
        <KpiAction label="Finalizados" value={report.finalizados.length} icon={CheckCircle2} tone="green" detail={`${report.total ? Math.round((report.finalizados.length / report.total) * 100) : 0}% del backlog`} onClick={() => setFilter({ type: 'finalizados', label: 'Tickets finalizados' })} />
        <KpiCard label="Salud PI" value={`${report.score}%`} icon={Target} tone={report.score < 60 ? 'red' : report.score < 80 ? 'amber' : 'green'} detail={report.score < 80 ? 'Requiere atención' : 'Sin riesgo crítico'} />
        <KpiCard label="Carga equipo" value={`${Math.round(report.cargaTotal)}h`} icon={Gauge} tone={report.ocupacionGlobal > 100 ? 'red' : report.ocupacionGlobal > 80 ? 'amber' : 'green'} detail={`${report.ocupacionGlobal}% de ${Math.round(report.capacidadTotal)}h`} />
        <KpiAction label="Sin asignación" value={report.sinAsignacion.length} icon={AlertTriangle} tone={report.sinAsignacion.length ? 'amber' : 'neutral'} detail="Sin fecha inicio" onClick={() => setFilter({ type: 'sin_asignacion', label: 'Sin fecha de asignación' })} />
        <KpiAction label="Sin planificación" value={report.sinPlanificacion.length} icon={PieChart} tone={report.sinPlanificacion.length ? 'amber' : 'neutral'} detail="Sin horas estimadas" onClick={() => setFilter({ type: 'sin_planificacion', label: 'Sin planificación' })} />
        <KpiAction label="Siguiente PI" value={report.siguientePi.length} icon={Clock3} tone={report.siguientePi.length ? 'red' : 'neutral'} detail="Superan fecha fin del PI" onClick={() => setFilter({ type: 'siguiente_pi', label: 'Pasan al siguiente PI' })} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <DataPanel title="Proyección de cierre" icon={TrendingUp}>
          <div className="grid gap-3 p-4 sm:grid-cols-3">
            <div className="rounded border border-corporate-line bg-white px-3 py-2">
              <p className="text-[11px] uppercase text-corporate-muted">Capacidad restante</p>
              <p className={clsx('mt-1 font-mono text-lg font-semibold', report.capacidadRestante < 0 ? 'text-red-700' : 'text-green-700')}>{Math.round(report.capacidadRestante)}h</p>
            </div>
            <div className="rounded border border-corporate-line bg-white px-3 py-2">
              <p className="text-[11px] uppercase text-corporate-muted">Horas backlog</p>
              <p className="mt-1 font-mono text-lg font-semibold text-corporate-ink">{Math.round(report.horasTotal)}h</p>
            </div>
            <div className="rounded border border-corporate-line bg-white px-3 py-2">
              <p className="text-[11px] uppercase text-corporate-muted">Pendientes críticos</p>
              <p className="mt-1 font-mono text-lg font-semibold text-red-700">{report.vencidos.length + report.escaladosActivos.length}</p>
            </div>
          </div>
        </DataPanel>
        <DataPanel title="Acciones recomendadas" icon={Filter}>
          <div className="space-y-2 p-4">
            {report.recomendaciones.length === 0 ? (
              <p className="text-xs text-corporate-muted">Sin acciones críticas calculadas para este PI.</p>
            ) : report.recomendaciones.map(item => (
              <div key={item} className="rounded border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">{item}</div>
            ))}
          </div>
        </DataPanel>
      </div>

      <SegmentedBar
        title="Estado ejecutivo"
        segments={[
          { label: 'Finalizados', value: report.finalizados.length, className: 'bg-green-500' },
          { label: 'Vencidos', value: report.vencidos.length, className: 'bg-red-500' },
          { label: 'Escalados activos', value: report.escaladosActivos.length, className: 'bg-amber-500' },
          { label: 'En curso', value: Math.max(report.total - report.finalizados.length - report.vencidos.length - report.escaladosActivos.length, 0), className: 'bg-allianz-blue' },
        ]}
      />

      <div className="grid gap-4 xl:grid-cols-3">
        <ChartPanel title="Tickets por status" rows={report.porStatus} tone="blue" onSelect={value => setFilter({ type: 'status', label: `Status: ${value}`, value })} />
        <ChartPanel title="Tickets por tipo" rows={report.porIssueType} tone="purple" onSelect={value => setFilter({ type: 'issue_type', label: `Tipo: ${value}`, value })} />
        <ChartPanel title="Horas por tecnología" rows={report.techHours} tone="green" onSelect={value => setFilter({ type: 'technology', label: `Tecnología: ${value}`, value })} />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <RiskList title="Tickets más vencidos" rows={report.vencidos} empty="No hay tickets vencidos sin entrega." onOpen={() => setFilter({ type: 'vencidos', label: 'Tickets vencidos' })} />
        <RiskList title="Escalados activos" rows={report.escaladosActivos} empty="No hay tickets escalados activos." onOpen={() => setFilter({ type: 'escalados', label: 'Escalados activos' })} />
        <RiskList title="Sin fecha de finalización" rows={report.sinFinalizacion} empty="Todos los tickets planificados tienen fecha final." onOpen={() => setFilter({ type: 'sin_finalizacion', label: 'Sin fecha de finalización' })} />
        <RiskList title="Pasan al siguiente PI" rows={report.siguientePi} empty="Todos los tickets caben dentro del PI actual." onOpen={() => setFilter({ type: 'siguiente_pi', label: 'Pasan al siguiente PI' })} />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-corporate-line bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-corporate-muted">
          <Filter size={14} />
          <span>Filtro actual:</span>
          <span className="font-semibold text-corporate-ink">{filter.label}</span>
          <span>({detailRows.length})</span>
        </div>
        {filter.type !== 'all' && (
          <button type="button" onClick={() => setFilter({ type: 'all', label: 'Todos los tickets' })} className="inline-flex items-center gap-1 text-xs text-corporate-muted hover:text-corporate-ink">
            <X size={13} /> Limpiar filtro
          </button>
        )}
      </div>
      <DetailTable rows={detailRows} piActivo={piActivo} />
    </div>
  )
}
