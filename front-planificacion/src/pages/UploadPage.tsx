import { useCallback, useRef, useState } from 'react'
import {
  Upload, FileSpreadsheet, X, AlertCircle,
  Loader2, GitBranch, CheckCircle2, Database,
} from 'lucide-react'
import clsx from 'clsx'
import { PageHeader } from '../components/ui/Corporate'
import {
  analizarBacklog, importarBacklog,
  BacklogAnalisis, BacklogImportResult, BacklogTicket,
} from '../services/api'

type Step = 'idle' | 'analyzing' | 'ready' | 'importing' | 'done'

export function UploadPage() {
  const [dragging, setDragging] = useState(false)
  const [step, setStep]         = useState<Step>('idle')
  const [error, setError]       = useState<string | null>(null)
  const [analisis, setAnalisis] = useState<BacklogAnalisis | null>(null)
  const [resultado, setResultado] = useState<BacklogImportResult | null>(null)
  const [currentFile, setCurrentFile] = useState<File | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function processFile(file: File) {
    setError(null)
    setAnalisis(null)
    setResultado(null)
    setCurrentFile(file)
    setStep('analyzing')
    try {
      const data = await analizarBacklog(file)
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
      const res = await importarBacklog(currentFile)
      setResultado(res)
      setStep('done')
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error importando el backlog')
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
        title="Subir Info MD/FA"
        subtitle="Importa tickets desde Excel a los backlogs de Mejora Continua y Fábrica"
      />

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mx-auto max-w-2xl space-y-5">

          {/* Error */}
          {error && (
            <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
              <AlertCircle size={16} className="mt-0.5 shrink-0 text-red-600" />
              <span className="flex-1 text-sm text-red-700">{error}</span>
              <button onClick={() => setError(null)}><X size={14} className="text-red-400 hover:text-red-600" /></button>
            </div>
          )}

          {/* ── IDLE / DROP ZONE ── */}
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

          {/* ── ANALYZING ── */}
          {step === 'analyzing' && (
            <div className="flex flex-col items-center gap-4 rounded-xl border border-corporate-line bg-white py-20">
              <Loader2 size={36} className="animate-spin text-allianz-blue" />
              <div className="text-center">
                <p className="text-sm font-semibold text-corporate-ink">Clasificando tickets…</p>
                <p className="mt-1 text-xs text-corporate-muted">
                  Leyendo Epic Link y buscando en proyectos de la BD
                </p>
              </div>
            </div>
          )}

          {/* ── READY — mostrar clasificación y botón importar ── */}
          {(step === 'ready' || step === 'importing') && analisis && (
            <div className="space-y-4">
              {/* Archivo */}
              <div className="flex items-center justify-between rounded-lg border border-corporate-line bg-white px-4 py-3">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-md border border-green-200 bg-green-50">
                    <FileSpreadsheet size={18} className="text-green-700" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-corporate-ink">{currentFile?.name}</p>
                    <p className="text-xs text-corporate-muted">{analisis.total} tickets encontrados</p>
                  </div>
                </div>
                <button onClick={reset} disabled={step === 'importing'}
                  className="flex items-center gap-1 text-xs text-corporate-muted hover:text-corporate-ink disabled:opacity-40">
                  <X size={13} /> Cambiar archivo
                </button>
              </div>

              {/* Conteos */}
              <div className="grid grid-cols-3 gap-3">
                {[
                  { label: 'Total tickets',    value: analisis.total,          color: 'text-corporate-ink'  },
                  { label: 'Mejora Continua',  value: analisis.total_mc,       color: 'text-allianz-blue'   },
                  { label: 'Fábrica',          value: analisis.total_fabrica,  color: 'text-emerald-700'    },
                ].map(({ label, value, color }) => (
                  <div key={label} className="rounded-lg border border-corporate-line bg-white px-4 py-4 text-center">
                    <p className={`text-3xl font-bold ${color}`}>{value}</p>
                    <p className="mt-1 text-xs text-corporate-muted">{label}</p>
                  </div>
                ))}
              </div>

              {/* Mapeo y duplicados */}
              <div className="space-y-3">
                {analisis.mapeo_con_ia && (
                  <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
                    <p className="text-xs font-semibold text-allianz-blue">Columnas mapeadas con IA</p>
                    <p className="mt-1 text-xs text-corporate-muted">
                      Se usó Azure OpenAI porque el Excel no coincidía con la estructura esperada.
                      {typeof analisis.confianza_ia === 'number' ? ` Confianza: ${Math.round(analisis.confianza_ia * 100)}%.` : ''}
                    </p>
                  </div>
                )}

                {!!analisis.total_duplicados && analisis.total_duplicados > 0 && (
                  <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle size={15} className="mt-0.5 shrink-0 text-amber-700" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-amber-800">IBL repetidos detectados</p>
                        <p className="mt-1 text-xs text-amber-700">
                          Se omitirán al importar: {analisis.duplicados_archivo?.length ?? 0} repetidos en el archivo
                          {' '}y {analisis.duplicados_bd?.length ?? 0} ya existentes en el backlog.
                        </p>
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {[...(analisis.duplicados_archivo ?? []), ...(analisis.duplicados_bd ?? [])].slice(0, 12).map((dup, i) => (
                            <span key={`${dup.ticket_key}-${i}`} className="rounded border border-amber-300 bg-white px-2 py-0.5 font-mono text-[11px] text-amber-800">
                              {dup.ticket_key}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Épicas detectadas */}
              {analisis.proyectos_detectados.length > 0 && (
                <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-corporate-line bg-white px-4 py-3">
                  <span className="text-xs text-corporate-muted mr-1 flex items-center gap-1">
                    <GitBranch size={12} /> Épicas detectadas:
                  </span>
                  {analisis.proyectos_detectados.map(p => (
                    <span key={p} className="rounded border border-allianz-blue/20 bg-blue-50 px-2 py-0.5 font-mono text-[11px] font-medium text-allianz-blue">{p}</span>
                  ))}
                </div>
              )}

              {/* Muestras */}
              <div className="grid gap-3 sm:grid-cols-2">
                <MiniSample title="Mejora Continua" tickets={analisis.muestra_mc} tone="blue" />
                <MiniSample title="Fábrica"         tickets={analisis.muestra_fabrica} tone="green" />
              </div>

              {/* BOTÓN PRINCIPAL */}
              <button
                onClick={handleImportar}
                disabled={step === 'importing'}
                className="flex w-full items-center justify-center gap-2 rounded-xl bg-allianz-blue py-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {step === 'importing'
                  ? <><Loader2 size={18} className="animate-spin" /> Importando…</>
                  : <><Database size={18} /> Importar {analisis.total} tickets al Backlog</>
                }
              </button>
            </div>
          )}

          {/* ── DONE ── */}
          {step === 'done' && resultado && (
            <div className="space-y-4">
              <div className="flex items-start gap-4 rounded-xl border border-green-200 bg-green-50 p-6">
                <CheckCircle2 size={32} className="shrink-0 text-green-600" />
                <div className="flex-1">
                  <p className="text-base font-semibold text-green-800">Importación completada</p>
                  <p className="mt-1 text-xs text-green-700">Los tickets están ahora disponibles en las pestañas de Backlog de cada módulo.</p>
                  <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {[
                      { label: 'Mejora Continua',   value: resultado.insertados_mc },
                      { label: 'Fábrica',            value: resultado.insertados_fabrica },
                      { label: 'Total insertados',   value: resultado.insertados_mc + resultado.insertados_fabrica },
                      { label: 'Duplicados omitidos',value: resultado.duplicados_omitidos },
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

function MiniSample({ title, tickets, tone }: { title: string; tickets: BacklogTicket[]; tone: 'blue' | 'green' }) {
  if (tickets.length === 0) return null
  const border = tone === 'blue' ? 'border-blue-200' : 'border-emerald-200'
  const bg     = tone === 'blue' ? 'bg-blue-50'      : 'bg-emerald-50'
  const hdr    = tone === 'blue' ? 'text-allianz-blue' : 'text-emerald-700'

  return (
    <div className={`rounded-lg border ${border} ${bg} overflow-hidden`}>
      <p className={`px-3 py-2 text-[11px] font-semibold ${hdr} border-b ${border}`}>
        {title} — muestra {tickets.length}
      </p>
      <ul className="divide-y divide-white/60">
        {tickets.map((t, i) => (
          <li key={i} className="flex items-start gap-2 px-3 py-2">
            <span className="shrink-0 font-mono text-[11px] font-semibold text-corporate-muted w-20 truncate">{t.ticket_key ?? '—'}</span>
            <span className="text-[11px] text-corporate-ink line-clamp-1" title={t.summary}>{t.summary}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}
