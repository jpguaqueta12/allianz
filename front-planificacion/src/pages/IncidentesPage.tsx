import { useState } from 'react'
import { RefreshCw, Users, BarChart2, CalendarDays, Clock3, List } from 'lucide-react'
import { useIncidentes } from '../hooks/useIncidentes'
import { useIncidentesStore } from '../stores/incidentesStore'
import { CapacidadPanel } from '../components/dashboard/CapacidadPanel'
import { ProyectosPanel } from '../components/dashboard/ProyectosPanel'
import { BacklogIncidentesPanel } from '../components/dashboard/BacklogIncidentesPanel'
import { DataPanel, PageHeader, StatusBadge } from '../components/ui/Corporate'

type Tab = 'capacidad' | 'proyectos' | 'backlog'

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: 'capacidad', label: 'Capacidad', icon: <Users size={16} /> },
  { id: 'proyectos', label: 'Proyectos', icon: <BarChart2 size={16} /> },
  { id: 'backlog',   label: 'Backlog',   icon: <List size={16} /> },
]

export function IncidentesPage() {
  const { refresh } = useIncidentes(30_000)
  const { data, loading, error, lastRefresh } = useIncidentesStore()
  const [tab, setTab] = useState<Tab>('capacidad')

  if (error) return (
    <div className="flex items-center justify-center h-full">
      <p className="text-red-600">Error: {error}</p>
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
        title={`Incidentes${data.pi_activo ? ` · ${data.pi_activo.nombre}` : ''}`}
        subtitle="Capacidad, proyectos y backlog de incidentes"
        meta={data.pi_activo ? (
          <>
            <StatusBadge tone="blue"><CalendarDays size={12} className="mr-1" />{data.pi_activo.fecha_inicio} a {data.pi_activo.fecha_fin}</StatusBadge>
            <StatusBadge>{data.pi_activo.dias_laborables} días laborables</StatusBadge>
            <StatusBadge>{data.pi_activo.horas_por_persona}h/persona</StatusBadge>
            {lastRefresh && <StatusBadge><Clock3 size={12} className="mr-1" />{lastRefresh.toLocaleTimeString('es-CO')}</StatusBadge>}
          </>
        ) : <StatusBadge tone="red">Sin PI activo</StatusBadge>}
        actions={(
          <button onClick={refresh} disabled={loading} className="corporate-button-secondary">
            <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
            Actualizar
          </button>
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
                pi={data.pi_activo}
              />
            )}

            {tab === 'proyectos' && (
              <ProyectosPanel
                proyectos={data.resumen_proyectos}
                piId={data.pi_activo?.id}
                modulo="INCIDENTES"
                onRefresh={refresh}
              />
            )}

            {tab === 'backlog' && (
              <BacklogIncidentesPanel active={tab === 'backlog'} />
            )}
          </div>
        </DataPanel>
      </div>
    </div>
  )
}
