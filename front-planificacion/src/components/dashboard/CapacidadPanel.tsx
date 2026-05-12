import { useState } from 'react'
import {
  UserPlus, Trash2, Check, X, AlertTriangle, RefreshCw, Search,
  Users, Gauge, Clock3, Activity, Layers, ListFilter,
} from 'lucide-react'
import clsx from 'clsx'
import { PersonaCapacidad } from '../../types'
import { DataPanel, KpiCard, StatusBadge } from '../ui/Corporate'
import { crearPersonaEnCapacidad, removePersonaCapacidad, sincronizarCapacidadAPI } from '../../services/api'

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
}

const estadoColor: Record<string, string> = {
  'DISPONIBLE':    'green',
  'OCUPADO':       'amber',
  'SOBRECARGADO':  'red',
  'LIDER TECNICO': 'purple',
  'SIN CAPACIDAD': 'neutral',
}

type VistaCapacidad = 'riesgo' | 'tecnologia'
type FiltroCapacidad = 'TODOS' | 'SOBRECARGADO' | 'DISPONIBLE' | 'OCUPADO' | 'SIN_CAPACIDAD' | 'JAVA' | 'COBOL'

const FILTERS: { id: FiltroCapacidad; label: string }[] = [
  { id: 'TODOS', label: 'Todos' },
  { id: 'SOBRECARGADO', label: 'Sobrecargados' },
  { id: 'DISPONIBLE', label: 'Disponibles' },
  { id: 'OCUPADO', label: 'Ocupados' },
  { id: 'SIN_CAPACIDAD', label: 'Sin capacidad' },
  { id: 'JAVA', label: 'JAVA' },
  { id: 'COBOL', label: 'COBOL' },
]

const riskRank: Record<string, number> = {
  'SOBRECARGADO': 0,
  'SIN CAPACIDAD': 1,
  'OCUPADO': 2,
  'LIDER TECNICO': 3,
  'DISPONIBLE': 4,
}

function ocupacionPct(persona: PersonaCapacidad): number | null {
  return persona.capacidad ? Math.round((persona.carga_estimada / persona.capacidad) * 100) : null
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
  onSubmit: (nombre: string, apellidos: string, tecnologia: string) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [apellidos, setApellidos] = useState('')
  const [tecnologia, setTecnologia] = useState<'JAVA' | 'COBOL'>('JAVA')
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
            onChange={e => setTecnologia(e.target.value as 'JAVA' | 'COBOL')}
          >
            <option value="JAVA">JAVA</option>
            <option value="COBOL">COBOL</option>
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
  horasPorPersona,
}: {
  personas: PersonaCapacidad[]
  horasPorPersona: number
}) {
  const capacidadTotal = personas.reduce((sum, p) => sum + (p.capacidad ?? 0), 0)
  const cargaTotal = personas.reduce((sum, p) => sum + (p.carga_estimada ?? 0), 0)
  const disponibleTotal = personas.reduce((sum, p) => sum + (p.horas_disponibles ?? 0), 0)
  const sobrecargados = personas.filter(p => p.estado === 'SOBRECARGADO')
  const sinCapacidad = personas.filter(p => p.estado === 'SIN CAPACIDAD' || !p.capacidad)
  const pctGlobal = capacidadTotal > 0 ? Math.round((cargaTotal / capacidadTotal) * 100) : 0
  const exceso = sobrecargados.reduce((sum, p) => sum + Math.max(0, -(p.horas_disponibles ?? 0)), 0)
  const parciales = personas.filter(p => p.capacidad != null && p.capacidad !== horasPorPersona)

  return (
    <div className="space-y-3">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
        <KpiCard
          label="Capacidad total"
          value={`${Math.round(capacidadTotal)}h`}
          icon={Users}
          tone="blue"
          detail={`${personas.length} persona${personas.length !== 1 ? 's' : ''}`}
        />
        <KpiCard
          label="Carga planificada"
          value={`${Math.round(cargaTotal)}h`}
          icon={Activity}
          tone={pctGlobal > 100 ? 'red' : pctGlobal > 80 ? 'amber' : 'green'}
          detail={`${pctGlobal}% ocupación global`}
        />
        <KpiCard
          label="Disponible"
          value={`${Math.round(disponibleTotal)}h`}
          icon={Clock3}
          tone={disponibleTotal < 0 ? 'red' : 'green'}
          detail={disponibleTotal < 0 ? 'Déficit de capacidad' : 'Saldo del PI'}
        />
        <KpiCard
          label="Sobrecarga"
          value={sobrecargados.length}
          icon={AlertTriangle}
          tone={sobrecargados.length ? 'red' : 'neutral'}
          detail={sobrecargados.length ? `${Math.round(exceso)}h de exceso` : 'Sin exceso'}
        />
        <KpiCard
          label="Capacidad parcial"
          value={parciales.length}
          icon={Gauge}
          tone={parciales.length || sinCapacidad.length ? 'amber' : 'neutral'}
          detail={`${sinCapacidad.length} sin capacidad`}
        />
      </div>

      {(sobrecargados.length > 0 || sinCapacidad.length > 0 || parciales.length > 0) && (
        <div className="grid gap-2 md:grid-cols-3">
          {sobrecargados.length > 0 && (
            <div className="rounded-md border border-red-100 bg-red-50 px-3 py-2 text-xs text-red-700">
              <span className="font-semibold">{sobrecargados.length} persona{sobrecargados.length !== 1 ? 's' : ''} sobrecargada{sobrecargados.length !== 1 ? 's' : ''}</span>
              <span className="ml-1">suman {Math.round(exceso)}h de exceso.</span>
            </div>
          )}
          {sinCapacidad.length > 0 && (
            <div className="rounded-md border border-amber-100 bg-amber-50 px-3 py-2 text-xs text-amber-800">
              <span className="font-semibold">{sinCapacidad.length} persona{sinCapacidad.length !== 1 ? 's' : ''} sin capacidad</span>
              <span className="ml-1">requieren revisión.</span>
            </div>
          )}
          {parciales.length > 0 && (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
              <span className="font-semibold">{parciales.length} capacidad{parciales.length !== 1 ? 'es' : ''} parcial{parciales.length !== 1 ? 'es' : ''}</span>
              <span className="ml-1">distintas a {horasPorPersona}h del PI.</span>
            </div>
          )}
        </div>
      )}
    </div>
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
}: {
  title: string
  description: string
  rows: PersonaCapacidad[]
  piId?: number
  onRefresh?: () => void
  horasPorPersona: number
  onRemove: (persona: PersonaCapacidad) => void
  onAdd: () => void
}) {
  return (
    <DataPanel title={title} description={description}>
      <div className="overflow-x-auto">
        <table className="corporate-table">
          <thead>
            <tr>
              {['Nombre', 'Tecnología', 'Capacidad', 'Carga', 'Disponible', 'Ocupación', 'Estado', ...(piId && onRefresh ? [''] : [])].map((h, i) => (
                <th key={i}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={8} className="px-3 py-6 text-center">
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
            ) : rows.map((p) => {
              const pct = ocupacionPct(p)
              const capDiffersFromPi = horasPorPersona != null && p.capacidad != null && p.capacidad !== horasPorPersona
              const disponible = p.horas_disponibles ?? null
              const over = Math.max(0, -(disponible ?? 0))
              return (
                <tr key={p.id} className="hover:bg-corporate-surface">
                  <td className="whitespace-nowrap font-medium text-corporate-ink">{p.nombre}</td>
                  <td><StatusBadge tone={p.tecnologia === 'JAVA' ? 'blue' : 'green'}>{p.tecnologia}</StatusBadge></td>
                  <td className="text-right font-mono">
                    <span>{formatHours(p.capacidad)}</span>
                    {capDiffersFromPi && (
                      <AlertTriangle
                        size={12}
                        className="ml-1 inline text-amber-600"
                        aria-label="Capacidad parcial"
                      />
                    )}
                  </td>
                  <td className="text-right font-mono">{formatHours(p.carga_estimada)}</td>
                  <td className={clsx(
                    'text-right font-mono',
                    (disponible ?? 0) < 0 ? 'text-red-600 font-bold' : 'text-green-700',
                  )}>
                    {formatHours(disponible)}
                    {over > 0 && <span className="ml-1 text-[10px] font-semibold text-red-600">+{formatHours(over)}</span>}
                  </td>
                  <td className="min-w-[150px]">
                    {pct != null ? (
                      <div className="space-y-1" title={`${formatHours(p.carga_estimada)} de ${formatHours(p.capacidad)}`}>
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[11px] text-corporate-muted">{formatHours(p.carga_estimada)} / {formatHours(p.capacidad)}</span>
                          <span className="font-mono text-xs">{pct}%</span>
                        </div>
                        <div className="h-2 rounded-full bg-gray-200">
                          <div
                            className={clsx('h-2 rounded-full', pct > 100 ? 'bg-red-500' : pct > 80 ? 'bg-amber-500' : pct > 50 ? 'bg-blue-500' : 'bg-green-500')}
                            style={{ width: `${Math.min(pct, 100)}%` }}
                          />
                        </div>
                      </div>
                    ) : '—'}
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
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </DataPanel>
  )
}

export function CapacidadPanel({ personas, piId, horasPorPersona = 0, onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState<{ id: number; nombre: string } | null>(null)
  const [removing, setRemoving] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState<{ ok: boolean; text: string } | null>(null)
  const [vista, setVista] = useState<VistaCapacidad>('riesgo')
  const [filtro, setFiltro] = useState<FiltroCapacidad>('TODOS')
  const [search, setSearch] = useState('')

  const filtered = sortByRisk(personas).filter(p => {
    if (filtro === 'JAVA' && p.tecnologia !== 'JAVA') return false
    if (filtro === 'COBOL' && p.tecnologia !== 'COBOL') return false
    if (filtro === 'SIN_CAPACIDAD' && p.estado !== 'SIN CAPACIDAD') return false
    if (filtro !== 'TODOS' && filtro !== 'JAVA' && filtro !== 'COBOL' && filtro !== 'SIN_CAPACIDAD' && p.estado !== filtro) return false
    const q = search.trim().toLowerCase()
    if (!q) return true
    return `${p.nombre} ${p.tecnologia} ${p.estado}`.toLowerCase().includes(q)
  })
  const cobol = filtered.filter(p => p.tecnologia === 'COBOL')
  const java  = filtered.filter(p => p.tecnologia === 'JAVA')

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

  async function handleCrear(nombre: string, apellidos: string, tecnologia: string) {
    if (!piId) throw new Error('Sin PI activo')
    await crearPersonaEnCapacidad(piId, { nombre, apellidos, tecnologia })
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

      <CapacitySummary personas={personas} horasPorPersona={horasPorPersona} />

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
          />
        </div>
      )}
    </div>
  )
}
