import { useState } from 'react'
import { FolderPlus, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { ResumenProyecto } from '../../types'
import { DataPanel } from '../ui/Corporate'
import { crearProyectoEnCapacidad, removeProyectoCapacidad } from '../../services/api'

interface Props {
  proyectos: ResumenProyecto[]
  piId?: number
  modulo?: string
  onRefresh?: () => void
}

function ConfirmModal({
  nombre,
  loading,
  onConfirm,
  onCancel,
}: {
  nombre: string
  loading: boolean
  onConfirm: () => void
  onCancel: () => void
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
            <p className="text-sm font-semibold text-corporate-ink">Quitar proyecto de este PI</p>
            <p className="mt-1 text-xs text-corporate-muted">
              ¿Confirmas que deseas quitar <span className="font-medium text-corporate-ink">{nombre}</span> de la capacidad de este PI?
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

function AddProyectoForm({
  modulo,
  onDone,
  onCancel,
  onSubmit,
}: {
  modulo: string
  onDone: () => void
  onCancel: () => void
  onSubmit: (nombre: string, identi: string) => Promise<void>
}) {
  const [nombre, setNombre] = useState('')
  const [identi, setIdenti] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit() {
    if (!nombre.trim() || !identi.trim()) {
      setError('Nombre e identificador son obligatorios')
      return
    }
    if (identi.trim().length > 20) {
      setError('El identificador no puede superar 20 caracteres')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await onSubmit(nombre.trim(), identi.trim())
      onDone()
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error al crear proyecto')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-lg border border-allianz-blue/20 bg-blue-50 p-4">
      <p className="mb-3 text-xs font-semibold text-allianz-blue">Nuevo proyecto</p>
      <div className="flex flex-wrap gap-3">
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Nombre del proyecto</label>
          <input
            autoFocus
            type="text"
            placeholder="Ej: Mi Proyecto"
            className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink w-64"
            value={nombre}
            onChange={e => setNombre(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Identificador (máx 20 car.)</label>
          <input
            type="text"
            placeholder="Ej: MIPROYECTO"
            className="rounded border border-corporate-line bg-white px-2 py-1.5 text-xs text-corporate-ink w-40 uppercase"
            value={identi}
            onChange={e => setIdenti(e.target.value.toUpperCase())}
          />
        </div>
        <div className="flex flex-col gap-1">
          <label className="text-[11px] font-medium text-corporate-muted">Módulo</label>
          <div className="flex items-center rounded border border-corporate-line bg-gray-100 px-2 py-1.5 text-xs text-corporate-muted w-36">
            {modulo}
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

export function ProyectosPanel({ proyectos, piId, modulo = '', onRefresh }: Props) {
  const [showForm, setShowForm] = useState(false)
  const [confirm, setConfirm] = useState<{ id: number; nombre: string } | null>(null)
  const [removing, setRemoving] = useState(false)

  async function handleConfirmRemove() {
    if (!confirm || !piId || !onRefresh) return
    setRemoving(true)
    try {
      await removeProyectoCapacidad(piId, confirm.id)
      onRefresh()
    } finally {
      setRemoving(false)
      setConfirm(null)
    }
  }

  async function handleCrear(nombre: string, identi: string) {
    if (!piId) throw new Error('Sin PI activo')
    await crearProyectoEnCapacidad(piId, { nombre, identi, modulo })
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
          <AddProyectoForm
            modulo={modulo}
            onDone={() => { setShowForm(false); onRefresh() }}
            onCancel={() => setShowForm(false)}
            onSubmit={handleCrear}
          />
        ) : (
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-1.5 rounded-md border border-allianz-blue/30 bg-blue-50 px-3 py-1.5 text-xs font-medium text-allianz-blue hover:bg-blue-100"
          >
            <FolderPlus size={14} /> Agregar proyecto
          </button>
        )
      )}

      <DataPanel
        title="Proyectos del PI"
        description={`${proyectos.length} proyecto${proyectos.length !== 1 ? 's' : ''} · capacidades en 0 hasta asignación de backlog`}
      >
        <div className="overflow-x-auto">
          <table className="corporate-table">
            <thead>
              <tr>
                {['Identificador', 'Proyecto', 'Cap Java (h)', 'Cap Cobol (h)', ...(piId && onRefresh ? [''] : [])].map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {proyectos.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-3 py-6 text-center text-xs text-corporate-muted">
                    Sin proyectos asignados a este PI.
                  </td>
                </tr>
              ) : proyectos.map((p) => (
                <tr key={p.id} className="hover:bg-corporate-surface">
                  <td className="font-mono text-xs font-semibold text-allianz-blue whitespace-nowrap">{p.identi}</td>
                  <td className="text-corporate-ink">{p.nombre}</td>
                  <td className="text-right font-mono text-corporate-muted">{p.cap_java_horas}</td>
                  <td className="text-right font-mono text-corporate-muted">{p.cap_cobol_horas}</td>
                  {piId && onRefresh && (
                    <td>
                      <button
                        onClick={() => setConfirm({ id: p.id, nombre: p.nombre })}
                        className="rounded p-1 text-gray-300 hover:text-red-500"
                        title="Quitar de este PI"
                      >
                        <Trash2 size={13} />
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </DataPanel>
    </div>
  )
}
