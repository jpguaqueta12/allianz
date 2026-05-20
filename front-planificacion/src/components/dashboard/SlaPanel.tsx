import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle, CheckCircle2, Clock3, Download, FileWarning,
  Filter, Loader2, PauseCircle, RefreshCw, ShieldCheck, TimerReset, XCircle,
} from 'lucide-react'
import clsx from 'clsx'
import { getSlaReport, SlaReport, SlaSubtask, SlaTicket } from '../../services/api'
import { DataPanel, KpiCard, StatusBadge } from '../ui/Corporate'

interface Props {
  modulo: 'MEJORA_CONTINUA' | 'FABRICA'
  piId?: number | null
  active: boolean
}

const ESTADO_TONE: Record<SlaTicket['estado_sla'], 'blue' | 'red' | 'green' | 'amber' | 'neutral' | 'purple'> = {
  EN_TIEMPO: 'green',
  EN_RIESGO: 'amber',
  VENCIDO: 'red',
  CUMPLIDO: 'green',
  INCUMPLIDO: 'red',
  PAUSADO: 'purple',
  SIN_INICIO: 'neutral',
}

const ESTADO_LABEL: Record<SlaTicket['estado_sla'], string> = {
  EN_TIEMPO: 'En tiempo',
  EN_RIESGO: 'En riesgo',
  VENCIDO: 'Vencido',
  CUMPLIDO: 'Cumplido',
  INCUMPLIDO: 'Incumplido',
  PAUSADO: 'Pausado',
  SIN_INICIO: 'Sin inicio',
}

type SlaFilter = 'TODOS' | SlaTicket['estado_sla']

function csvCell(value: unknown) {
  const text = value == null ? '' : String(value)
  return `"${text.replace(/"/g, '""')}"`
}

function downloadCsv(filename: string, rows: SlaTicket[]) {
  const headers = [
    'ticket_key', 'summary', 'status', 'estado_sla', 'sla_dias', 'consumido_dias',
    'restante_dias', 'pausa_dias', 'fecha_inicio_sla', 'fecha_limite_sla',
    'fecha_comprometida_cliente', 'fecha_fin_real', 'fecha_entrega', 'fecha_escalado', 'fecha_reinicio', 'policy',
  ]
  const body = rows.map(ticket => [
    ticket.ticket_key, ticket.summary, ticket.status, ticket.estado_sla, ticket.sla_dias,
    ticket.consumido_dias, ticket.restante_dias, ticket.pausa_dias,
    ticket.fecha_inicio_sla, ticket.fecha_limite_sla, ticket.fecha_comprometida_cliente, ticket.fecha_fin_real, ticket.fecha_entrega,
    ticket.fecha_escalado, ticket.fecha_reinicio, ticket.policy.nombre,
  ].map(csvCell).join(','))
  const blob = new Blob([[headers.map(csvCell).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function downloadSubtasksCsv(filename: string, rows: SlaSubtask[]) {
  const headers = [
    'ticket_key', 'summary', 'tarea', 'subtarea', 'responsable', 'perfil', 'horas',
    'status', 'estado_sla', 'sla_dias', 'consumido_dias', 'restante_dias', 'pausa_dias',
    'fecha_inicio_sla', 'fecha_limite_sla', 'fecha_escalamiento', 'policy',
  ]
  const body = rows.map(row => [
    row.ticket_key, row.summary, row.tarea, row.subtarea, row.responsable, row.perfil, row.horas,
    row.status, row.estado_sla, row.sla_dias, row.consumido_dias, row.restante_dias, row.pausa_dias,
    row.fecha_inicio_sla, row.fecha_limite_sla, row.fecha_escalamiento, row.policy.nombre,
  ].map(csvCell).join(','))
  const blob = new Blob([[headers.map(csvCell).join(','), ...body].join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function StateBars({ report, onSelect }: { report: SlaReport; onSelect: (filter: SlaFilter) => void }) {
  const rows = Object.entries(report.summary.por_estado)
    .map(([estado, value]) => ({ estado: estado as SlaTicket['estado_sla'], value }))
    .sort((a, b) => b.value - a.value)
  const max = Math.max(...rows.map(r => r.value), 1)
  const color: Record<SlaTicket['estado_sla'], string> = {
    EN_TIEMPO: 'bg-green-500',
    EN_RIESGO: 'bg-amber-500',
    VENCIDO: 'bg-red-500',
    CUMPLIDO: 'bg-emerald-500',
    INCUMPLIDO: 'bg-red-700',
    PAUSADO: 'bg-violet-500',
    SIN_INICIO: 'bg-slate-400',
  }
  return (
    <DataPanel title="Distribución SLA" icon={ShieldCheck}>
      <div className="space-y-3 p-4">
        {rows.map(row => (
          <button
            type="button"
            key={row.estado}
            onClick={() => onSelect(row.estado)}
            className="grid w-full grid-cols-[100px_1fr_44px] items-center gap-3 rounded px-1 py-0.5 text-left hover:bg-corporate-surface"
          >
            <span className="text-xs font-medium text-corporate-ink">{ESTADO_LABEL[row.estado]}</span>
            <div className="h-2 rounded-full bg-corporate-surface">
              <div className={clsx('h-2 rounded-full', color[row.estado])} style={{ width: `${Math.max(4, (row.value / max) * 100)}%` }} />
            </div>
            <span className="text-right font-mono text-xs text-corporate-muted">{row.value}</span>
          </button>
        ))}
      </div>
    </DataPanel>
  )
}

function PolicyPanel({ report }: { report: SlaReport }) {
  return (
    <DataPanel title="Políticas SLA activas" icon={TimerReset}>
      <div className="divide-y divide-corporate-line">
        {report.policies.map(policy => (
          <div key={`${policy.id}-${policy.nombre}`} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_auto]">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-corporate-ink">{policy.nombre}</p>
              <p className="mt-0.5 text-[11px] text-corporate-muted">
                {policy.issue_type ?? 'Cualquier tipo'} · {policy.priority ?? 'Cualquier prioridad'} · pausa escalado {policy.pausa_escalado ? 'activa' : 'inactiva'}
              </p>
            </div>
            <StatusBadge tone="blue">{policy.sla_dias} días</StatusBadge>
          </div>
        ))}
      </div>
    </DataPanel>
  )
}

function SlaTable({ rows }: { rows: SlaTicket[] }) {
  return (
    <DataPanel title="Detalle SLA" description={`${rows.length} ticket${rows.length !== 1 ? 's' : ''}`}>
      <div className="overflow-x-auto">
        <table className="corporate-table">
          <thead>
            <tr>
              {['Key', 'SLA', 'Status ticket', 'Inicio', 'Compromiso cliente', 'F. Fin Real', 'Entrega', 'Restante', 'Pausa', 'Progreso'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-xs text-corporate-muted">Sin tickets para este filtro.</td></tr>
            ) : rows.slice(0, 80).map(ticket => (
              <tr key={ticket.id} className="hover:bg-corporate-surface">
                <td>
                  <p className="font-mono text-xs font-semibold text-allianz-blue">{ticket.ticket_key ?? `#${ticket.id}`}</p>
                  <p className="mt-0.5 line-clamp-1 max-w-[260px] text-[11px] text-corporate-muted" title={ticket.summary}>{ticket.summary}</p>
                </td>
                <td><StatusBadge tone={ESTADO_TONE[ticket.estado_sla]}>{ESTADO_LABEL[ticket.estado_sla]}</StatusBadge></td>
                <td><StatusBadge>{ticket.status ?? 'Sin status'}</StatusBadge></td>
                <td className="font-mono text-xs">{ticket.fecha_inicio_sla ?? '-'}</td>
                <td className="font-mono text-xs">{ticket.fecha_limite_sla ?? '-'}</td>
                <td className="font-mono text-xs">{ticket.fecha_fin_real ?? '-'}</td>
                <td className="font-mono text-xs">{ticket.fecha_entrega ?? '-'}</td>
                <td className={clsx('text-right font-mono', (ticket.restante_dias ?? 0) < 0 && 'font-bold text-red-700')}>
                  {ticket.restante_dias ?? '-'}
                </td>
                <td className="text-right font-mono">{ticket.pausa_dias}</td>
                <td className="min-w-[150px]">
                  <div className="space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-corporate-muted">{ticket.consumido_dias}/{ticket.sla_dias} días</span>
                      <span className="font-mono text-xs">{ticket.progreso_pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-corporate-surface">
                      <div
                        className={clsx('h-2 rounded-full', ticket.progreso_pct > 100 ? 'bg-red-600' : ticket.progreso_pct > 70 ? 'bg-amber-500' : 'bg-green-500')}
                        style={{ width: `${Math.min(ticket.progreso_pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataPanel>
  )
}

function SlaSubtasksTable({ rows }: { rows: SlaSubtask[] }) {
  return (
    <DataPanel title="Detalle SLA subtareas" description={`${rows.length} subtarea${rows.length !== 1 ? 's' : ''}`}>
      <div className="overflow-x-auto">
        <table className="corporate-table">
          <thead>
            <tr>
              {['Key', 'Subtarea', 'Responsable', 'SLA', 'Status', 'Inicio', 'Fin plan', 'Esc.', 'Restante', 'Progreso'].map(h => <th key={h}>{h}</th>)}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-xs text-corporate-muted">Sin subtareas para este filtro.</td></tr>
            ) : rows.slice(0, 120).map(row => (
              <tr key={row.id} className="hover:bg-corporate-surface">
                <td>
                  <p className="font-mono text-xs font-semibold text-allianz-blue">{row.ticket_key ?? `#${row.ticket_id}`}</p>
                  <p className="mt-0.5 line-clamp-1 max-w-[220px] text-[11px] text-corporate-muted" title={row.summary}>{row.summary}</p>
                </td>
                <td>
                  <p className="line-clamp-1 max-w-[240px] text-xs font-medium text-corporate-ink" title={row.subtarea ?? row.tarea ?? ''}>{row.subtarea ?? row.tarea ?? '-'}</p>
                  <p className="mt-0.5 text-[11px] text-corporate-muted">{row.perfil ?? '-'} · {row.horas ?? 0}h</p>
                </td>
                <td className="text-xs">{row.responsable ?? '-'}</td>
                <td><StatusBadge tone={ESTADO_TONE[row.estado_sla]}>{ESTADO_LABEL[row.estado_sla]}</StatusBadge></td>
                <td><StatusBadge>{row.status ?? 'Sin status'}</StatusBadge></td>
                <td className="font-mono text-xs">{row.fecha_inicio_sla ?? '-'}</td>
                <td className="font-mono text-xs">{row.fecha_limite_sla ?? '-'}</td>
                <td className="font-mono text-xs">{row.fecha_escalamiento ?? '-'}</td>
                <td className={clsx('text-right font-mono', (row.restante_dias ?? 0) < 0 && 'font-bold text-red-700')}>
                  {row.restante_dias ?? '-'}
                </td>
                <td className="min-w-[150px]">
                  <div className="space-y-1">
                    <div className="flex justify-between gap-2">
                      <span className="text-[11px] text-corporate-muted">{row.consumido_dias}/{row.sla_dias} días</span>
                      <span className="font-mono text-xs">{row.progreso_pct}%</span>
                    </div>
                    <div className="h-2 rounded-full bg-corporate-surface">
                      <div
                        className={clsx('h-2 rounded-full', row.progreso_pct > 100 ? 'bg-red-600' : row.progreso_pct > 70 ? 'bg-amber-500' : 'bg-green-500')}
                        style={{ width: `${Math.min(row.progreso_pct, 100)}%` }}
                      />
                    </div>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </DataPanel>
  )
}

export function SlaPanel({ modulo, piId, active }: Props) {
  const [report, setReport] = useState<SlaReport | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [loadedKey, setLoadedKey] = useState<string | null>(null)
  const [filter, setFilter] = useState<SlaFilter>('TODOS')
  const key = `${modulo}:${piId ?? 'activo'}`

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getSlaReport(modulo, piId)
      setReport(data)
      setLoadedKey(key)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando SLA')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (active && loadedKey !== key) load()
  }, [active, key, loadedKey])

  const filtered = useMemo(() => {
    if (!report) return []
    if (filter === 'TODOS') return report.tickets
    return report.tickets.filter(ticket => ticket.estado_sla === filter)
  }, [report, filter])

  const filteredSubtasks = useMemo(() => {
    if (!report) return []
    const items = report.subtasks?.items ?? []
    if (filter === 'TODOS') return items
    return items.filter(item => item.estado_sla === filter)
  }, [report, filter])

  const critical = useMemo(() => {
    if (!report) return []
    return report.tickets
      .filter(ticket => ['VENCIDO', 'EN_RIESGO', 'PAUSADO', 'INCUMPLIDO'].includes(ticket.estado_sla))
      .sort((a, b) => (a.restante_dias ?? 9999) - (b.restante_dias ?? 9999))
      .slice(0, 8)
  }, [report])

  const criticalSubtasks = useMemo(() => {
    if (!report) return []
    return (report.subtasks?.items ?? [])
      .filter(item => ['VENCIDO', 'EN_RIESGO', 'PAUSADO', 'INCUMPLIDO'].includes(item.estado_sla))
      .sort((a, b) => (a.restante_dias ?? 9999) - (b.restante_dias ?? 9999))
      .slice(0, 8)
  }, [report])

  if (loading && !report) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-corporate-muted">
        <Loader2 size={20} className="animate-spin" /> Cargando SLA...
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

  if (!report) return null
  const subtasksSummary = report.subtasks?.summary ?? {
    total: 0,
    por_estado: {},
    cumplidos: 0,
    incumplidos: 0,
    vencidos: 0,
    en_riesgo: 0,
    pausados: 0,
    sin_inicio: 0,
    abiertos: 0,
    cumplimiento_pct: 0,
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-corporate-ink">Monitoreo SLA</p>
          <p className="text-xs text-corporate-muted">
            {modulo === 'FABRICA' ? 'Fábrica' : 'Mejora Continua'} · referencia {report.fecha_referencia} · {report.summary.abiertos} abiertos
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button onClick={() => downloadCsv(`sla-${modulo.toLowerCase()}-${report.fecha_referencia}.csv`, filtered)} className="corporate-button-secondary">
            <Download size={14} /> Exportar CSV
          </button>
          <button onClick={() => downloadSubtasksCsv(`sla-subtareas-${modulo.toLowerCase()}-${report.fecha_referencia}.csv`, filteredSubtasks)} className="corporate-button-secondary">
            <Download size={14} /> Exportar subtareas
          </button>
          <button onClick={load} disabled={loading} className="corporate-button-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} /> Actualizar SLA
          </button>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Cumplimiento" value={`${report.summary.cumplimiento_pct}%`} icon={ShieldCheck} tone={report.summary.cumplimiento_pct < 80 ? 'amber' : 'green'} detail={`${report.summary.cumplidos} cumplidos / ${report.summary.incumplidos} incumplidos`} />
        <KpiCard label="Vencidos SLA" value={report.summary.vencidos} icon={XCircle} tone={report.summary.vencidos ? 'red' : 'green'} detail="Fuera del compromiso cliente" />
        <KpiCard label="En riesgo" value={report.summary.en_riesgo} icon={FileWarning} tone={report.summary.en_riesgo ? 'amber' : 'neutral'} detail="Cerca del compromiso" />
        <KpiCard label="Pausados" value={report.summary.pausados} icon={PauseCircle} tone={report.summary.pausados ? 'amber' : 'neutral'} detail="Escalamiento activo" />
        <KpiCard label="En tiempo" value={report.summary.por_estado.EN_TIEMPO ?? 0} icon={Clock3} tone="green" detail="Abiertos sanos" />
        <KpiCard label="Sin inicio" value={report.summary.sin_inicio} icon={AlertTriangle} tone={report.summary.sin_inicio ? 'amber' : 'neutral'} detail="Sin compromiso o inicio" />
        <KpiCard label="Cerrados cumplidos" value={report.summary.cumplidos} icon={CheckCircle2} tone="green" detail="Fin real dentro del compromiso" />
        <KpiCard label="Cerrados incumplidos" value={report.summary.incumplidos} icon={XCircle} tone={report.summary.incumplidos ? 'red' : 'neutral'} detail="Fin real fuera del compromiso" />
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-corporate-muted">SLA por subtareas</p>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <KpiCard label="Subtareas" value={subtasksSummary.total} icon={ShieldCheck} tone="blue" detail={`${subtasksSummary.abiertos} abiertas`} />
          <KpiCard label="Subtareas vencidas" value={subtasksSummary.vencidos} icon={XCircle} tone={subtasksSummary.vencidos ? 'red' : 'green'} detail="Fecha fin de subtarea superada" />
          <KpiCard label="Subtareas en riesgo" value={subtasksSummary.en_riesgo} icon={FileWarning} tone={subtasksSummary.en_riesgo ? 'amber' : 'neutral'} detail="Cerca de la fecha fin" />
          <KpiCard label="Subtareas pausadas" value={subtasksSummary.pausados} icon={PauseCircle} tone={subtasksSummary.pausados ? 'amber' : 'neutral'} detail="Con escalamiento activo" />
          <KpiCard label="Subtareas en tiempo" value={subtasksSummary.por_estado.EN_TIEMPO ?? 0} icon={Clock3} tone="green" detail="Abiertas sanas" />
          <KpiCard label="Subtareas sin inicio" value={subtasksSummary.sin_inicio} icon={AlertTriangle} tone={subtasksSummary.sin_inicio ? 'amber' : 'neutral'} detail="Sin fecha inicio o fin" />
          <KpiCard label="Subtareas cumplidas" value={subtasksSummary.cumplidos} icon={CheckCircle2} tone="green" detail={`${subtasksSummary.cumplimiento_pct}% cumplimiento`} />
          <KpiCard label="Subtareas incumplidas" value={subtasksSummary.incumplidos} icon={XCircle} tone={subtasksSummary.incumplidos ? 'red' : 'neutral'} detail="Cerradas fuera de fecha" />
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_1fr]">
        <StateBars report={report} onSelect={setFilter} />
        <PolicyPanel report={report} />
      </div>

      <DataPanel title="Tickets SLA críticos" icon={AlertTriangle}>
        <div className="divide-y divide-corporate-line">
          {critical.length === 0 ? (
            <p className="p-4 text-xs text-corporate-muted">No hay tickets SLA críticos.</p>
          ) : critical.map(ticket => (
            <button
              type="button"
              key={ticket.id}
              onClick={() => setFilter(ticket.estado_sla)}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-corporate-surface"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-allianz-blue">{ticket.ticket_key ?? `#${ticket.id}`}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-corporate-ink" title={ticket.summary}>{ticket.summary}</p>
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge tone={ESTADO_TONE[ticket.estado_sla]}>{ESTADO_LABEL[ticket.estado_sla]}</StatusBadge>
                <p className="mt-1 font-mono text-[11px] text-corporate-muted">{ticket.restante_dias ?? '-'} días</p>
              </div>
            </button>
          ))}
        </div>
      </DataPanel>

      <DataPanel title="Subtareas SLA críticas" icon={AlertTriangle}>
        <div className="divide-y divide-corporate-line">
          {criticalSubtasks.length === 0 ? (
            <p className="p-4 text-xs text-corporate-muted">No hay subtareas SLA críticas.</p>
          ) : criticalSubtasks.map(item => (
            <button
              type="button"
              key={item.id}
              onClick={() => setFilter(item.estado_sla)}
              className="flex w-full items-start justify-between gap-3 px-4 py-3 text-left hover:bg-corporate-surface"
            >
              <div className="min-w-0">
                <p className="font-mono text-xs font-semibold text-allianz-blue">{item.ticket_key ?? `#${item.ticket_id}`}</p>
                <p className="mt-0.5 line-clamp-1 text-xs text-corporate-ink" title={item.subtarea ?? item.tarea ?? ''}>{item.subtarea ?? item.tarea ?? '-'}</p>
                <p className="mt-0.5 text-[11px] text-corporate-muted">{item.responsable ?? '-'} · {item.perfil ?? '-'}</p>
              </div>
              <div className="shrink-0 text-right">
                <StatusBadge tone={ESTADO_TONE[item.estado_sla]}>{ESTADO_LABEL[item.estado_sla]}</StatusBadge>
                <p className="mt-1 font-mono text-[11px] text-corporate-muted">{item.restante_dias ?? '-'} días</p>
              </div>
            </button>
          ))}
        </div>
      </DataPanel>

      <div className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-corporate-line bg-white px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-corporate-muted">
          <Filter size={14} />
          <span>Filtro SLA:</span>
          <span className="font-semibold text-corporate-ink">{filter === 'TODOS' ? 'Todos' : ESTADO_LABEL[filter]}</span>
          <span>({filtered.length} tickets · {filteredSubtasks.length} subtareas)</span>
        </div>
        {filter !== 'TODOS' && (
          <button type="button" onClick={() => setFilter('TODOS')} className="inline-flex items-center gap-1 text-xs text-corporate-muted hover:text-corporate-ink">
            Limpiar filtro
          </button>
        )}
      </div>

      <SlaTable rows={filtered} />
      <SlaSubtasksTable rows={filteredSubtasks} />
    </div>
  )
}
