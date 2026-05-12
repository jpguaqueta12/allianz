import { useCallback, useRef, useState } from 'react'
import {
  Upload, FileSpreadsheet, X, AlertCircle,
  Loader2, CheckCircle2, Database,
} from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '../components/ui/Corporate'
import {
  analizarIncidentes, importarIncidentes,
  IncidentesAnalisis, IncidentesImportResult, IncidenteTicket,
} from '../services/api'

type Step = 'idle' | 'analyzing' | 'ready' | 'importing' | 'done'

export function UploadIncidentesPage() {
  const [dragging, setDragging]     = useState(false)
  const [step, setStep]             = useState<Step>('idle')
  const [error, setError]           = useState<string | null>(null)
  const [analisis, setAnalisis]     = useState<IncidentesAnalisis | null>(null)
  const [resultado, setResultado]   = useState<IncidentesImportResult | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    setError(null)
    setAnalisis(null)
    setResultado(null)
    setCurrentFile(file)
    setStep('analyzing')
    try {
      const data = await analizarIncidentes(file)
      setAnalisis(data)
      setStep('ready')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error procesando el archivo')
      setStep('idle')
    }
  }

  async function handleImportar() {
    if (!currentFile) return
    setStep('importing')
    setError(null)
    try {
      const res = await importarIncidentes(currentFile)
      setResultado(res)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error importando incidentes')
      setStep('ready')
    }
  }

  function reset() {
    setStep('idle')
    setError(null)
    setAnalisis(null)
    setResultado(null)
    setCurrentFile(null)
  }

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [])

  const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) processFile(file)
    e.target.value = ''
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      <PageHeader
        title="Subir Incidentes"
        subtitle="Importa incidentes desde Excel al backlog del Módulo de Incidentes"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">

          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
              <span className="flex-1 text-sm text-red-700">{error}</span>
              <button onClick={() => setError(null)}><X size={14} className="text-red-400 hover:text-red-600" /></button>
            </div>
          )}

          {step === 'idle' && (
            <div
              onDragOver={e => { e.preventDefault(); setDragging(true) }}
              onDragLeave={() => setDragging(false)}
              onDrop={onDrop}
              onClick={() => inputRef.current?.click()}
              className={clsx(
                'flex cursor-pointer flex-col items-center justify-center gap-4 rounded-xl border-2 border-dashed px-8 py-20 transition-colors',
                dragging
                  ? 'border-allianz-blue bg-blue-50'
                  : 'border-corporate-line bg-white hover:border-allianz-blue/50 hover:bg-corporate-surface',
              )}
            >
              <input ref={inputRef} type="file" accept=".xlsx,.xls,.xlsm" className="hidden" onChange={onFileChange} />
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-corporate-line bg-corporate-surface">
                <Upload size={28} className="text-allianz-blue" />
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-corporate-ink">Arrastra el Excel aquí o haz clic para seleccionarlo</p>
                <p className="mt-1 text-xs text-corporate-muted">.xlsx · .xls · .xlsm · máx 20 MB</p>
              </div>
            </div>
          )}

          {step === 'analyzing' && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-corporate-line bg-white py-20">
              <Loader2 size={36} className="animate-spin text-allianz-blue" />
              <div className="text-center">
                <p className="text-sm font-semibold text-corporate-ink">Analizando incidentes…</p>
                <p className="mt-1 text-xs text-corporate-muted">Leyendo columnas y preparando vista previa</p>
              </div>
            </div>
          )}

          {(step === 'ready' || step === 'importing') && analisis && (
            <div className="space-y-4">
              <div className="flex items-center justify-between rounded-lg border border-corporate-line bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-green-200 bg-green-50">
                    <FileSpreadsheet size={18} className="text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-corporate-ink">{currentFile?.name}</p>
                    <p className="text-xs text-corporate-muted">{analisis.total} incidentes encontrados</p>
                  </div>
                </div>
                <button onClick={reset} disabled={step === 'importing'}
                  className="flex items-center gap-1 text-xs text-corporate-muted hover:text-corporate-ink disabled:opacity-40">
                  <X size={13} /> Cambiar archivo
                </button>
              </div>

              <div className="rounded-lg border border-corporate-line bg-white px-4 py-4 text-center">
                <p className="text-3xl font-bold text-allianz-blue">{analisis.total}</p>
                <p className="mt-1 text-xs text-corporate-muted">Total incidentes</p>
              </div>

              {analisis.muestra.length > 0 && (
                <MiniSample tickets={analisis.muestra} />
              )}

              <button
                onClick={handleImportar}
                disabled={step === 'importing'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-allianz-blue py-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {step === 'importing'
                  ? <><Loader2 size={18} className="animate-spin" /> Importando…</>
                  : <><Database size={18} /> Importar {analisis.total} incidentes al Backlog</>
                }
              </button>
            </div>
          )}

          {step === 'done' && resultado && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-green-200 bg-green-50 p-6">
                <CheckCircle2 size={32} className="shrink-0 text-green-600" />
                <div className="flex-1">
                  <p className="text-base font-semibold text-green-800">Importación completada</p>
                  <p className="mt-1 text-xs text-green-700">Los incidentes están ahora disponibles en la pestaña Backlog del Módulo de Incidentes.</p>
                  <div className="mt-4 grid grid-cols-3 gap-3">
                    {[
                      { label: 'Insertados',         value: resultado.insertados },
                      { label: 'Duplicados omitidos', value: resultado.duplicados_omitidos },
                      { label: 'Total procesados',    value: resultado.total_procesados },
                    ].map(({ label, value }) => (
                      <div key={label} className="rounded-lg border border-green-200 bg-white px-3 py-3 text-center">
                        <p className="text-2xl font-bold text-green-700">{value}</p>
                        <p className="mt-0.5 text-[11px] text-corporate-muted">{label}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <button onClick={reset}
                className="flex items-center gap-2 rounded-lg border border-corporate-line bg-white px-4 py-2.5 text-sm font-medium text-corporate-muted hover:text-corporate-ink">
                <Upload size={15} /> Subir otro archivo
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}

function MiniSample({ tickets }: { tickets: IncidenteTicket[] }) {
  return (
    <div className="rounded-lg border border-orange-200 bg-orange-50 overflow-hidden">
      <p className="px-3 py-2 text-[11px] font-semibold text-orange-700 border-b border-orange-200">
        Muestra — primeros {tickets.length} incidentes
      </p>
      <ul className="divide-y divide-white/60">
        {tickets.map((t, i) => (
          <li key={i} className="flex items-start gap-2 px-3 py-2">
            <span className="shrink-0 font-mono text-[11px] font-semibold text-corporate-muted w-28 truncate">{t.numero ?? '—'}</span>
            <span className="flex-1 text-[11px] text-corporate-ink truncate" title={t.equipo ?? ''}>{t.equipo ?? '—'}</span>
            <span className="shrink-0 text-[11px] text-orange-700">{t.estado_sn ?? '—'}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
