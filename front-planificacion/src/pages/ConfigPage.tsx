import { useEffect, useState } from 'react'
import { PiInfo, Festivo } from '../types'
import { activarPi, addFestivo, createPi, deleteFestivo, deletePi, getFestivos, getPis, updatePi } from '../services/api'
import clsx from 'clsx'
import { CalendarDays, CheckCircle2, Clock4, PlusCircle, Settings2, Sparkles, Trash2, Users, Zap } from 'lucide-react'
import { PageHeader } from '../components/ui/Corporate'

const estadoColor: Record<string, string> = {
  ACTIVO:        'bg-green-100 text-green-700',
  PLANIFICACION: 'bg-yellow-100 text-yellow-700',
  CERRADO:       'bg-gray-100 text-gray-500',
}

const estadoIcon: Record<string, React.ReactNode> = {
  ACTIVO:        <Zap size={12} />,
  PLANIFICACION: <Clock4 size={12} />,
  CERRADO:       <CheckCircle2 size={12} />,
}

interface SuggestedFestivo {
  fecha: string
  nombre: string
}

function parseIsoDate(value: string): Date {
  return new Date(`${value}T00:00:00Z`)
}

function toIsoDate(value: Date): string {
  return value.toISOString().slice(0, 10)
}

function addDays(value: Date, days: number): Date {
  const next = new Date(value)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function observedMonday(year: number, month: number, day: number): Date {
  const value = new Date(Date.UTC(year, month - 1, day))
  const weekday = value.getUTCDay()
  return addDays(value, weekday === 1 ? 0 : (8 - weekday) % 7)
}

function easterSunday(year: number): Date {
  const a = year % 19
  const b = Math.floor(year / 100)
  const c = year % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(Date.UTC(year, month - 1, day))
}

function colombiaHolidaysForYear(year: number): SuggestedFestivo[] {
  const easter = easterSunday(year)
  return [
    { fecha: `${year}-01-01`, nombre: 'Año Nuevo' },
    { fecha: toIsoDate(observedMonday(year, 1, 6)), nombre: 'Día de los Reyes Magos' },
    { fecha: toIsoDate(observedMonday(year, 3, 19)), nombre: 'Día de San José' },
    { fecha: toIsoDate(addDays(easter, -3)), nombre: 'Jueves Santo' },
    { fecha: toIsoDate(addDays(easter, -2)), nombre: 'Viernes Santo' },
    { fecha: `${year}-05-01`, nombre: 'Día del Trabajo' },
    { fecha: toIsoDate(addDays(easter, 43)), nombre: 'Ascensión del Señor' },
    { fecha: toIsoDate(addDays(easter, 64)), nombre: 'Corpus Christi' },
    { fecha: toIsoDate(addDays(easter, 71)), nombre: 'Sagrado Corazón de Jesús' },
    { fecha: toIsoDate(observedMonday(year, 6, 29)), nombre: 'San Pedro y San Pablo' },
    { fecha: `${year}-07-20`, nombre: 'Día de la Independencia' },
    { fecha: `${year}-08-07`, nombre: 'Batalla de Boyacá' },
    { fecha: toIsoDate(observedMonday(year, 8, 15)), nombre: 'Asunción de la Virgen' },
    { fecha: toIsoDate(observedMonday(year, 10, 12)), nombre: 'Día de la Raza' },
    { fecha: toIsoDate(observedMonday(year, 11, 1)), nombre: 'Todos los Santos' },
    { fecha: toIsoDate(observedMonday(year, 11, 11)), nombre: 'Independencia de Cartagena' },
    { fecha: `${year}-12-08`, nombre: 'Inmaculada Concepción' },
    { fecha: `${year}-12-25`, nombre: 'Navidad' },
  ].sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function suggestFestivosInRange(desde: string, hasta: string, existing: { fecha: string }[] = []): SuggestedFestivo[] {
  if (!desde || !hasta || desde > hasta) return []
  const startYear = parseIsoDate(desde).getUTCFullYear()
  const endYear = parseIsoDate(hasta).getUTCFullYear()
  const existingDates = new Set(existing.map(f => f.fecha))
  const seen = new Set<string>()
  const suggestions: SuggestedFestivo[] = []

  for (let year = startYear; year <= endYear; year++) {
    for (const holiday of colombiaHolidaysForYear(year)) {
      if (holiday.fecha < desde || holiday.fecha > hasta || existingDates.has(holiday.fecha) || seen.has(holiday.fecha)) continue
      seen.add(holiday.fecha)
      suggestions.push(holiday)
    }
  }
  return suggestions.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

function diasLaborables(desde: string, hasta: string, festivosFechas: string[] = []): number {
  if (!desde || !hasta) return 0
  const start = parseIsoDate(desde)
  const end   = parseIsoDate(hasta)
  const festivosSet = new Set(festivosFechas)
  let count = 0
  const cur = new Date(start)
  while (cur <= end) {
    const d = cur.getUTCDay()
    if (d !== 0 && d !== 6 && !festivosSet.has(toIsoDate(cur))) count++
    cur.setUTCDate(cur.getUTCDate() + 1)
  }
  return count
}

interface PiFormData {
  nombre: string
  fecha_inicio: string
  fecha_fin: string
  dias_laborables: number
  horas_por_dia: number
  descripcion: string
}

const EMPTY_FORM: PiFormData = {
  nombre: '', fecha_inicio: '', fecha_fin: '',
  dias_laborables: 0, horas_por_dia: 8, descripcion: '',
}

export function ConfigPage() {
  const [pis,         setPis]         = useState<PiInfo[]>([])
  const [capSummary,  setCapSummary]  = useState<{ personas: number; proyectos: number } | null>(null)
  const [selected,    setSelected]    = useState<PiInfo | null>(null)
  const [festivos,    setFestivos]    = useState<Festivo[]>([])
  const [form,        setForm]        = useState<PiFormData>(EMPTY_FORM)
  const [mode,        setMode]        = useState<'view' | 'create' | 'edit'>('view')
  const [saving,      setSaving]      = useState(false)
  const [activating,  setActivating]  = useState(false)
  const [deleting,    setDeleting]    = useState(false)
  const [addingSuggested, setAddingSuggested] = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const [activarInfo, setActivarInfo] = useState<{ nombre: string; personas: number; proyectos: number } | null>(null)
  const [deleteInfo,  setDeleteInfo]  = useState<{ nombre: string; total: number; replacement?: string | null } | null>(null)

  // Festivo form
  const [fFecha,  setFFecha]  = useState('')
  const [fNombre, setFNombre] = useState('')
  const [addingF, setAddingF] = useState(false)

  const load = async (preferredPiId?: number | null) => {
    const list = await getPis()
    setPis(list)
    const target =
      (preferredPiId ? list.find(p => p.id === preferredPiId) : null) ??
      (selected ? list.find(p => p.id === selected.id) : null) ??
      list.find(p => p.activo) ??
      list[0] ??
      null

    if (target) {
      await selectPi(target, list)
    } else {
      setSelected(null)
      setFestivos([])
      setCapSummary(null)
      setMode('view')
    }
    return list
  }

  useEffect(() => { load() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  async function selectPi(pi: PiInfo, list?: PiInfo[]) {
    const target = (list ?? pis).find(p => p.id === pi.id) ?? pi
    setSelected(target)
    setMode('view')
    setError(null)
    const [fs, cap] = await Promise.all([
      getFestivos(pi.id),
      getCapSummary(pi.id),
    ])
    setFestivos(fs)
    setCapSummary(cap)
  }

  async function getCapSummary(piId: number) {
    try {
      const base = `${import.meta.env.VITE_API_BASE_URL ?? ''}/api/v1`
      const r = await fetch(`${base}/config/pis/${piId}/capacidad-resumen`)
      if (!r.ok) return null
      return r.json()
    } catch { return null }
  }

  function startCreate() {
    setSelected(null)
    setForm(EMPTY_FORM)
    setFestivos([])
    setMode('create')
    setError(null)
  }

  function startEdit(pi: PiInfo) {
    setForm({
      nombre:          pi.nombre,
      fecha_inicio:    pi.fecha_inicio,
      fecha_fin:       pi.fecha_fin,
      dias_laborables: pi.dias_laborables,
      horas_por_dia:   pi.horas_por_dia,
      descripcion:     pi.descripcion ?? '',
    })
    setMode('edit')
    setError(null)
  }

  function handleFormChange(field: keyof PiFormData, value: string | number) {
    setForm(prev => {
      const next = { ...prev, [field]: value }
      // Auto-calcular días laborables al cambiar fechas
      if ((field === 'fecha_inicio' || field === 'fecha_fin') && next.fecha_inicio && next.fecha_fin) {
        const baseFestivos = mode === 'edit' ? festivos : []
        const suggested = suggestFestivosInRange(next.fecha_inicio, next.fecha_fin, baseFestivos)
        const fechasFestivas = [...baseFestivos.map(f => f.fecha), ...suggested.map(f => f.fecha)]
        next.dias_laborables = diasLaborables(next.fecha_inicio, next.fecha_fin, fechasFestivas)
      }
      return next
    })
  }

  async function handleSave() {
    setSaving(true)
    setError(null)
    setActivarInfo(null)
    setDeleteInfo(null)
    try {
      if (mode === 'create') {
        const pi = await createPi({
          nombre:          form.nombre,
          fecha_inicio:    form.fecha_inicio,
          fecha_fin:       form.fecha_fin,
          dias_laborables: form.dias_laborables,
          horas_por_dia:   form.horas_por_dia,
          descripcion:     form.descripcion || undefined,
        })
        await load(pi.id)
      } else if (mode === 'edit' && selected) {
        const pi = await updatePi(selected.id, {
          nombre:          form.nombre,
          fecha_inicio:    form.fecha_inicio,
          fecha_fin:       form.fecha_fin,
          dias_laborables: form.dias_laborables,
          horas_por_dia:   form.horas_por_dia,
          descripcion:     form.descripcion || undefined,
        })
        await load(pi.id)
        setMode('view')
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error guardando')
    } finally {
      setSaving(false)
    }
  }

  async function handleActivar(pi: PiInfo) {
    if (!window.confirm(`¿Activar ${pi.nombre}? El PI activo actual pasará a estado CERRADO.`)) return
    setActivating(true)
    setError(null)
    setActivarInfo(null)
    setDeleteInfo(null)
    try {
      const result = await activarPi(pi.id)
      await load(result.id)
      setActivarInfo({
        nombre:    result.nombre,
        personas:  result.personas_copiadas,
        proyectos: result.proyectos_copiados,
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error activando PI')
    } finally {
      setActivating(false)
    }
  }

  async function handleDeletePi(pi: PiInfo) {
    const msg = [
      `¿Eliminar ${pi.nombre}?`,
      'Se eliminarán también sus festivos, capacidad, proyectos configurados y backlog asociado a ese PI.',
      pi.activo ? 'Como es el PI activo, se activará automáticamente el PI más reciente que quede disponible.' : '',
      'Esta acción no se puede deshacer.',
    ].filter(Boolean).join('\n\n')
    if (!window.confirm(msg)) return
    setDeleting(true)
    setError(null)
    setActivarInfo(null)
    setDeleteInfo(null)
    try {
      const result = await deletePi(pi.id)
      const total = Object.values(result.deleted_counts ?? {}).reduce((sum, n) => sum + n, 0)
      setDeleteInfo({ nombre: pi.nombre, total, replacement: result.replacement_pi?.nombre ?? null })
      await load(result.replacement_pi?.id ?? null)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando PI')
    } finally {
      setDeleting(false)
    }
  }

  async function handleAddFestivo() {
    if (!selected || !fFecha || !fNombre.trim()) return
    setAddingF(true)
    try {
      const f = await addFestivo(selected.id, fFecha, fNombre.trim())
      setFestivos(prev => [...prev.filter(x => x.fecha !== f.fecha), f].sort((a, b) => a.fecha.localeCompare(b.fecha)))
      setFFecha(''); setFNombre('')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error añadiendo festivo')
    } finally {
      setAddingF(false)
    }
  }

  async function handleAddSuggestedFestivos(suggestions: SuggestedFestivo[]) {
    if (!selected || suggestions.length === 0) return
    setAddingSuggested(true)
    setError(null)
    try {
      const added: Festivo[] = []
      for (const suggestion of suggestions) {
        added.push(await addFestivo(selected.id, suggestion.fecha, suggestion.nombre))
      }
      setFestivos(prev => {
        const byDate = new Map<string, Festivo>()
        for (const f of prev) byDate.set(f.fecha, f)
        for (const f of added) byDate.set(f.fecha, f)
        return Array.from(byDate.values()).sort((a, b) => a.fecha.localeCompare(b.fecha))
      })
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error agregando festivos sugeridos')
    } finally {
      setAddingSuggested(false)
    }
  }

  async function handleDeleteFestivo(f: Festivo) {
    if (!selected) return
    try {
      await deleteFestivo(selected.id, f.id)
      setFestivos(prev => prev.filter(x => x.id !== f.id))
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error eliminando festivo')
    }
  }

  const horasPorPersona = form.dias_laborables * form.horas_por_dia
  const formSuggestedFestivos = suggestFestivosInRange(form.fecha_inicio, form.fecha_fin, mode === 'edit' ? festivos : [])
  const selectedSuggestedFestivos = selected ? suggestFestivosInRange(selected.fecha_inicio, selected.fecha_fin, festivos) : []

  return (
    <div className="h-full overflow-y-auto bg-corporate-surface">
      <PageHeader
        title="Configuración de PIs"
        subtitle="Gestiona Program Increments, festivos y capacidad inicial"
        actions={(
          <button
            onClick={startCreate}
            className="corporate-button-primary"
          >
            <PlusCircle size={14} /> Nuevo PI
          </button>
        )}
      />

      <div className="mx-auto max-w-5xl space-y-4 p-4">

        {error && (
          <div className="rounded-md border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700">
            {error}
          </div>
        )}

        {activarInfo && (
          <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">PI {activarInfo.nombre} activado correctamente</p>
              {activarInfo.personas > 0 || activarInfo.proyectos > 0 ? (
                <p className="text-xs mt-0.5 text-green-700">
                  Capacidad inicializada desde el PI anterior —{' '}
                  <b>{activarInfo.personas}</b> personas y{' '}
                  <b>{activarInfo.proyectos}</b> proyectos copiados con horas proporcionales al nuevo PI.
                </p>
              ) : (
                <p className="text-xs mt-0.5 text-green-700">
                  Este PI ya tenía capacidad configurada.
                </p>
              )}
            </div>
          </div>
        )}

        {deleteInfo && (
          <div className="flex items-start gap-3 rounded-md border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            <CheckCircle2 size={18} className="text-green-600 flex-shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">PI {deleteInfo.nombre} eliminado correctamente</p>
              <p className="text-xs mt-0.5 text-green-700">
                Se eliminaron {deleteInfo.total} registros asociados entre backlog y configuración operativa.
                {deleteInfo.replacement ? ` PI activo ahora: ${deleteInfo.replacement}.` : ''}
              </p>
            </div>
          </div>
        )}

        <div className="grid lg:grid-cols-[280px_1fr] gap-4 items-start">

          {/* ── Lista de PIs ── */}
          <div className="space-y-2">
            {pis.map(pi => (
              <div
                key={pi.id}
                onClick={() => selectPi(pi)}
                className={clsx(
                  'bg-white rounded-xl p-3 shadow-sm border cursor-pointer transition-all',
                  selected?.id === pi.id ? 'border-allianz-blue ring-1 ring-allianz-blue/20' : 'border-gray-100 hover:border-gray-300',
                )}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-semibold text-gray-800 text-sm">{pi.nombre}</span>
                  <span className={clsx('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', estadoColor[pi.estado])}>
                    {estadoIcon[pi.estado]} {pi.estado}
                  </span>
                </div>
                <div className="mt-1.5 space-y-0.5">
                  <div className="flex items-center gap-1 text-[11px] text-gray-500">
                    <CalendarDays size={11} />
                    {pi.fecha_inicio} → {pi.fecha_fin}
                  </div>
                  <div className="text-[11px] text-gray-400">
                    {pi.dias_laborables} días · {pi.horas_por_persona}h/persona · {pi.festivos_count ?? 0} festivos
                  </div>
                </div>
                {!pi.activo && (
                  <button
                    onClick={e => { e.stopPropagation(); handleActivar(pi) }}
                    disabled={activating}
                    className="mt-2 w-full text-xs text-allianz-blue border border-allianz-blue rounded-lg py-1 hover:bg-allianz-blue hover:text-white transition-colors disabled:opacity-50"
                  >
                    {activating ? 'Activando…' : 'Activar este PI'}
                  </button>
                )}
                {pi.activo && (
                  <div className="mt-2 text-[11px] text-green-600 font-medium flex items-center gap-1">
                    <Zap size={11} /> PI activo en el dashboard
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* ── Panel derecho: detalle / formulario ── */}
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">

            {/* Crear / editar */}
            {(mode === 'create' || mode === 'edit') && (
              <div className="p-5 space-y-4">
                <h2 className="font-semibold text-gray-800 text-sm">
                  {mode === 'create' ? 'Crear nuevo PI' : `Editar ${selected?.nombre}`}
                </h2>

                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Nombre *</label>
                    <input
                      type="text"
                      value={form.nombre}
                      onChange={e => handleFormChange('nombre', e.target.value)}
                      placeholder="PI4-2026"
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Horas por día *</label>
                    <input
                      type="number" min={1} max={12}
                      value={form.horas_por_dia}
                      onChange={e => handleFormChange('horas_por_dia', parseInt(e.target.value) || 8)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha inicio *</label>
                    <input
                      type="date" value={form.fecha_inicio}
                      onChange={e => handleFormChange('fecha_inicio', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Fecha fin *</label>
                    <input
                      type="date" value={form.fecha_fin}
                      onChange={e => handleFormChange('fecha_fin', e.target.value)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Días laborables</label>
                    <input
                      type="number" min={1}
                      value={form.dias_laborables}
                      onChange={e => handleFormChange('dias_laborables', parseInt(e.target.value) || 0)}
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                    />
                    <p className="text-[10px] text-gray-400 mt-0.5">Se calcula automático al cambiar fechas (Lun–Vie)</p>
                  </div>
                  <div className="flex flex-col justify-end">
                    <div className="bg-allianz-blue/5 border border-allianz-blue/20 rounded-lg px-3 py-2 text-center">
                      <p className="text-2xl font-bold text-allianz-blue">{horasPorPersona}h</p>
                      <p className="text-[10px] text-gray-500">por persona ({form.dias_laborables}d × {form.horas_por_dia}h)</p>
                    </div>
                  </div>
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-medium text-gray-600 mb-1">Descripción</label>
                    <textarea
                      value={form.descripcion}
                      onChange={e => handleFormChange('descripcion', e.target.value)}
                      rows={2}
                      placeholder="Notas opcionales sobre este PI..."
                      className="w-full border border-gray-200 rounded-lg px-3 py-1.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                    />
                  </div>
                </div>

                {form.fecha_inicio && form.fecha_fin && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                    <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                      <Sparkles size={13} /> Festivos sugeridos para el rango
                    </div>
                    {formSuggestedFestivos.length > 0 ? (
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {formSuggestedFestivos.map(f => (
                          <span key={f.fecha} className="rounded-md bg-white px-2 py-1 text-[11px] text-amber-800 border border-amber-100">
                            {f.fecha} · {f.nombre}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <p className="mt-1 text-[11px] text-amber-700">No faltan festivos nacionales conocidos en este lapso.</p>
                    )}
                  </div>
                )}

                <div className="flex gap-2 pt-1">
                  <button
                    onClick={handleSave}
                    disabled={saving || !form.nombre || !form.fecha_inicio || !form.fecha_fin}
                    className="text-sm text-white bg-allianz-blue hover:bg-allianz-light rounded-lg px-4 py-1.5 disabled:opacity-40 transition-colors"
                  >
                    {saving ? 'Guardando…' : mode === 'create' ? 'Crear PI' : 'Guardar cambios'}
                  </button>
                  <button
                    onClick={() => { setMode('view'); setError(null) }}
                    className="text-sm text-gray-600 border border-gray-200 rounded-lg px-4 py-1.5 hover:bg-gray-50"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            )}

            {/* Vista de detalle */}
            {mode === 'view' && selected && (
              <div>
                <div className="p-5 border-b border-gray-100">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <h2 className="font-bold text-gray-800">{selected.nombre}</h2>
                        <span className={clsx('flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded-full', estadoColor[selected.estado])}>
                          {estadoIcon[selected.estado]} {selected.estado}
                        </span>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-3">
                        {[
                          { label: 'Inicio', value: selected.fecha_inicio },
                          { label: 'Fin',    value: selected.fecha_fin },
                          { label: 'Días',   value: `${selected.dias_laborables} laborables` },
                          { label: 'Horas/persona', value: `${selected.horas_por_persona}h (${selected.horas_por_dia}h/día)` },
                        ].map(({ label, value }) => (
                          <div key={label} className="bg-gray-50 rounded-lg px-3 py-2">
                            <p className="text-[10px] text-gray-400 font-medium uppercase">{label}</p>
                            <p className="text-sm font-semibold text-gray-700 mt-0.5">{value}</p>
                          </div>
                        ))}
                      </div>
                      {selected.descripcion && (
                        <p className="mt-3 text-xs text-gray-500 italic">{selected.descripcion}</p>
                      )}
                    </div>
                    <div className="flex flex-shrink-0 items-center gap-2">
                      <button
                        onClick={() => startEdit(selected)}
                        className="flex-shrink-0 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDeletePi(selected)}
                        disabled={deleting}
                        title="Eliminar PI"
                        className="flex-shrink-0 text-xs text-red-600 border border-red-200 rounded-lg px-3 py-1.5 hover:bg-red-50 transition-colors disabled:cursor-not-allowed disabled:opacity-40"
                      >
                        {deleting ? 'Eliminando…' : 'Eliminar'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Capacidad resumen */}
                {capSummary && (
                  <div className="px-5 pb-4 grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
                      <Users size={14} className="text-allianz-blue flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Personas con capacidad</p>
                        <p className="text-base font-bold text-allianz-blue">{capSummary.personas}</p>
                      </div>
                    </div>
                    <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2 flex items-center gap-2">
                      <Settings2 size={14} className="text-allianz-blue flex-shrink-0" />
                      <div>
                        <p className="text-[10px] text-gray-400 font-medium uppercase">Proyectos configurados</p>
                        <p className="text-base font-bold text-allianz-blue">{capSummary.proyectos}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Festivos */}
                <div className="p-5 pt-0">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3 flex items-center gap-2">
                    <CalendarDays size={14} /> Festivos Colombia ({festivos.length})
                  </h3>

                  {festivos.length > 0 ? (
                    <div className="space-y-1 mb-4">
                      {festivos.map(f => (
                        <div key={f.id} className="flex items-center justify-between py-1.5 px-3 rounded-lg hover:bg-gray-50 text-sm">
                          <span className="font-mono text-xs text-gray-500 w-28">{f.fecha}</span>
                          <span className="flex-1 text-gray-700 text-xs">{f.nombre}</span>
                          <button
                            onClick={() => handleDeleteFestivo(f)}
                            className="text-red-400 hover:text-red-600 ml-2 transition-colors"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 mb-4 italic">Sin festivos registrados para este PI.</p>
                  )}

                  {selectedSuggestedFestivos.length > 0 && (
                    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex items-center gap-2 text-xs font-semibold text-amber-800">
                          <Sparkles size={13} /> Sugerencias inteligentes para este rango
                        </div>
                        <button
                          onClick={() => handleAddSuggestedFestivos(selectedSuggestedFestivos)}
                          disabled={addingSuggested}
                          className="text-xs text-amber-800 border border-amber-300 bg-white rounded-lg px-2.5 py-1 hover:bg-amber-100 disabled:opacity-50"
                        >
                          {addingSuggested ? 'Agregando…' : 'Agregar sugeridos'}
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedSuggestedFestivos.map(f => (
                          <span key={f.fecha} className="rounded-md bg-white px-2 py-1 text-[11px] text-amber-800 border border-amber-100">
                            {f.fecha} · {f.nombre}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2 items-end">
                    <div>
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Fecha</label>
                      <input
                        type="date" value={fFecha} onChange={e => setFFecha(e.target.value)}
                        className="border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] font-medium text-gray-500 mb-1">Nombre del festivo</label>
                      <input
                        type="text" value={fNombre} onChange={e => setFNombre(e.target.value)}
                        placeholder="Día del trabajo"
                        className="w-full border border-gray-200 rounded-lg px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-allianz-blue/30"
                      />
                    </div>
                    <button
                      onClick={handleAddFestivo}
                      disabled={addingF || !fFecha || !fNombre.trim()}
                      className="flex items-center gap-1 text-xs text-white bg-allianz-blue hover:bg-allianz-light rounded-lg px-3 py-1 disabled:opacity-40 transition-colors whitespace-nowrap"
                    >
                      <PlusCircle size={12} /> Agregar
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Estado vacío */}
            {mode === 'view' && !selected && (
              <div className="p-10 text-center text-gray-400 text-sm">
                Selecciona un PI de la lista o crea uno nuevo.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
