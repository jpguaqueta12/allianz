import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle2, Clock, RefreshCw, XCircle } from 'lucide-react'
import clsx from 'clsx'
import { AlertaItem } from '../../types'
import { getAlertas } from '../../services/api'

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

// ── panel principal ───────────────────────────────────────────────────────────

interface Props {
  modulo: 'MEJORA_CONTINUA' | 'FABRICA'
  active: boolean
  piId?: number | null
}

export function AlertasPanel({ modulo, active, piId }: Props) {
  const [items, setItems]     = useState<AlertaItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [filtro, setFiltro]   = useState<Filtro>('alertas')
  const [loaded, setLoaded]   = useState(false)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getAlertas(modulo, piId)
      setItems(data)
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
  const qaItems  = items.filter(i => i.alerta_qa != null)
  const visible  = items.filter(i => matchFiltro(i, filtro))

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
      {/* resumen */}
      <div className="flex flex-wrap gap-3">
        <SummaryGroup title="Alertas — Desarrollo" items={devItems} field="alerta_desarrollo" />
        <SummaryGroup title="Alertas — QA"         items={qaItems}  field="alerta_qa" />
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
            <table className="w-full min-w-[820px] table-auto text-xs border-collapse">
              <thead>
                <tr className="bg-slate-800 text-white">
                  <th className="min-w-[100px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Key</th>
                  <th className="px-3 py-3 text-left font-semibold border-r border-white/10">Summary</th>
                  <th className="min-w-[100px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">F. Inicio</th>
                  <th className="min-w-[110px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Fin Desarrollo</th>
                  <th className="min-w-[110px] px-3 py-3 text-center font-semibold whitespace-nowrap border-r border-white/10">Alerta Dev</th>
                  <th className="min-w-[110px] px-3 py-3 text-left font-semibold whitespace-nowrap border-r border-white/10">Fin QA</th>
                  <th className="min-w-[110px] px-3 py-3 text-center font-semibold whitespace-nowrap border-r border-white/10">Alerta QA</th>
                  <th className="min-w-[130px] px-3 py-3 text-right font-semibold whitespace-nowrap">Horas (J / C / QA)</th>
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
                      <td className="px-3 py-2 border-r border-corporate-line/30 whitespace-nowrap text-corporate-muted">
                        {item.fecha_asignacion}
                      </td>
                      <td className="px-3 py-2 border-r border-corporate-line/30 whitespace-nowrap font-medium">
                        {item.fecha_fin_desarrollo}
                      </td>
                      <td className="px-3 py-2 border-r border-corporate-line/30 text-center">
                        <NivelBadge nivel={item.alerta_desarrollo} />
                      </td>
                      <td className="px-3 py-2 border-r border-corporate-line/30 whitespace-nowrap text-corporate-muted">
                        {item.fecha_fin_qa ?? '—'}
                      </td>
                      <td className="px-3 py-2 border-r border-corporate-line/30 text-center">
                        <NivelBadge nivel={item.alerta_qa} />
                      </td>
                      <td className="px-3 py-2 text-right font-mono text-[11px] whitespace-nowrap text-corporate-muted">
                        {item.java_horas > 0 && <span className="text-blue-600">J:{item.java_horas}h</span>}
                        {item.java_horas > 0 && item.cobol_horas > 0 && ' '}
                        {item.cobol_horas > 0 && <span className="text-emerald-600">C:{item.cobol_horas}h</span>}
                        {(item.java_horas > 0 || item.cobol_horas > 0) && item.qa_horas > 0 && ' '}
                        {item.qa_horas > 0 && <span className="text-rose-600">QA:{item.qa_horas}h</span>}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
