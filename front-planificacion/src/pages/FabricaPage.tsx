import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { RefreshCw, Users, BarChart2, CalendarDays, Clock3, ListTodo, AlertTriangle, PieChart, ShieldCheck, Settings2 } from 'lucide-react'
import { useFabrica } from '../hooks/useFabrica'
import { useFabricaStore } from '../stores/fabricaStore'
import { getPis } from '../services/api'
import { CapacidadPanel } from '../components/dashboard/CapacidadPanel'
import { ProyectosPanel } from '../components/dashboard/ProyectosPanel'
import { BacklogPanel } from '../components/dashboard/BacklogPanel'
import { AlertasPanel } from '../components/dashboard/AlertasPanel'
import { ReportePiPanel } from '../components/dashboard/ReportePiPanel'
import { SlaPanel } from '../components/dashboard/SlaPanel'
import { DataPanel, PageHeader, StatusBadge } from '../components/ui/Corporate'
import { getPiDisplayState } from '../utils/piStatus'
import { PiInfo } from '../types'

type Tab = 'capacidad' | 'proyectos' | 'backlog' | 'alertas' | 'reporte' | 'sla'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'capacidad', label: 'Capacidad', icon: <Users size={16} /> },
  { id: 'proyectos', label: 'Proyectos', icon: <BarChart2 size={16} /> },
  { id: 'backlog',   label: 'Backlog',   icon: <ListTodo size={16} /> },
  { id: 'alertas',   label: 'Alertas',   icon: <AlertTriangle size={16} /> },
  { id: 'reporte',   label: 'Reporte',   icon: <PieChart size={16} /> },
  { id: 'sla',       label: 'SLA',       icon: <ShieldCheck size={16} /> },
]

export function FabricaPage() {
  const [selectedPiId, setSelectedPiId] = useState<number | null>(null)
  const [pis, setPis] = useState<PiInfo[]>([])
  const { refresh } = useFabrica(30_000, selectedPiId)
  const { data, loading, error, lastRefresh } = useFabricaStore()
  const [tab, setTab] = useState<Tab>('capacidad')
  const piState = data?.pi_activo ? getPiDisplayState(data.pi_activo) : null
  const piOptions = pis.filter(pi => (pi.modulo ?? 'MEJORA_CONTINUA') === 'MEJORA_CONTINUA')

  useEffect(() => {
    getPis().then(setPis).catch(() => {})
  }, [])

  if (error) return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-6 text-center">
      <div className="rounded-xl border border-amber-200 bg-amber-50 px-8 py-6 max-w-md w-full">
        <Settings2 size={32} className="mx-auto mb-3 text-amber-500" />
        <p className="text-sm font-semibold text-amber-900 mb-1">Módulo sin PI activo</p>
        <p className="text-xs text-amber-700 mb-4">{error}</p>
        <Link
          to="/config"
          className="inline-flex items-center gap-2 rounded-lg bg-allianz-blue px-4 py-2 text-xs font-medium text-white hover:bg-allianz-light transition-colors"
        >
          <Settings2 size={13} /> Ir a Configuración PI
        </Link>
      </div>
    </div>
  )

  if (!data) return (
    <div className="flex items-center justify-center h-full">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-allianz-blue" />
    </div>
  )

  return (
    <div className="h-full overflow-y-auto bg-corporate-surface">
      <PageHeader
        title={`Fábrica${data.pi_activo ? ` · ${data.pi_activo.nombre}` : ''}`}
        subtitle="Backlog y reporte con PI/capacidad compartidos"
        meta={data.pi_activo ? (
          <>
            {piState && <StatusBadge tone={piState.tone}>{piState.label}</StatusBadge>}
            <StatusBadge tone="neutral">Capacidad compartida</StatusBadge>
            <StatusBadge tone="blue"><CalendarDays size={12} className="mr-1" />{data.pi_activo.fecha_inicio} a {data.pi_activo.fecha_fin}</StatusBadge>
            <StatusBadge>{data.pi_activo.dias_laborables} días laborables</StatusBadge>
            <StatusBadge>{data.pi_activo.horas_por_persona}h/persona</StatusBadge>
            {lastRefresh && <StatusBadge><Clock3 size={12} className="mr-1" />{lastRefresh.toLocaleTimeString('es-CO')}</StatusBadge>}
          </>
        ) : <StatusBadge tone="red">Sin PI activo</StatusBadge>}
        actions={(
          <>
            <select
              value={selectedPiId ?? ''}
              onChange={e => setSelectedPiId(e.target.value ? Number(e.target.value) : null)}
              className="rounded-md border border-corporate-line bg-white px-3 py-2 text-xs text-corporate-ink focus:border-allianz-blue focus:outline-none"
              aria-label="Seleccionar PI"
            >
              <option value="">PI activo</option>
              {piOptions.map(pi => {
                const state = getPiDisplayState(pi)
                return <option key={pi.id} value={pi.id}>{pi.nombre} · {state.label}</option>
              })}
            </select>
            <button onClick={refresh} disabled={loading} className="corporate-button-secondary">
              <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
              Actualizar
            </button>
          </>
        )}
      />

      <div className="space-y-4 p-4">
        <DataPanel>
          <div className="flex overflow-x-auto border-b border-corporate-line">
            {TABS.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-medium transition-colors ${
                  tab === t.id
                    ? 'border-allianz-blue text-allianz-blue'
                    : 'border-transparent text-corporate-muted hover:text-corporate-ink'
                }`}
              >
                {t.icon} {t.label}
              </button>
            ))}
          </div>

          <div className="p-4">
            {tab === 'capacidad' && (
              <CapacidadPanel
                personas={data.capacidad}
                piId={data.pi_activo?.id}
                horasPorPersona={data.pi_activo?.horas_por_persona}
                onRefresh={refresh}
              />
            )}
            {tab === 'proyectos' && (
              <ProyectosPanel
                proyectos={data.resumen_proyectos}
                piId={data.pi_activo?.id}
                modulo="FABRICA"
                onRefresh={refresh}
              />
            )}
            {tab === 'backlog' && (
              <BacklogPanel modulo="FABRICA" active={tab === 'backlog'} piActivo={data.pi_activo} piId={data.pi_activo?.id ?? selectedPiId} onCapacityRefresh={refresh} />
            )}
            {tab === 'alertas' && (
              <AlertasPanel modulo="FABRICA" active={tab === 'alertas'} piId={data.pi_activo?.id ?? selectedPiId} />
            )}
            {tab === 'reporte' && (
              <ReportePiPanel
                modulo="FABRICA"
                active={tab === 'reporte'}
                piId={data.pi_activo?.id ?? selectedPiId}
                piActivo={data.pi_activo}
                capacidad={data.capacidad}
              />
            )}
            {tab === 'sla' && (
              <SlaPanel
                modulo="FABRICA"
                active={tab === 'sla'}
                piId={data.pi_activo?.id ?? selectedPiId}
              />
            )}
          </div>
        </DataPanel>
      </div>
    </div>
  )
}
