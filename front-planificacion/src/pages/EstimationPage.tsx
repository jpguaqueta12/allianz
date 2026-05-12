import { useRef, useState } from 'react'
import clsx from 'clsx'
import {
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  ClipboardCopy,
  Clock,
  Download,
  FileText,
  Layers,
  Loader2,
  Paperclip,
  Plus,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Trash2,
  Upload,
  Users,
  Zap,
} from 'lucide-react'
import { exportEstimacionWord, extractFileText, generarEstimacion } from '../services/api'
import { EstimacionResult, EstimationCategory, EstimationDriver } from '../types'
import { PageHeader, KpiCard, DataPanel, StatusBadge } from '../components/ui/Corporate'

// ── Helpers ──────────────────────────────────────────────────────────────────

function fmt(n: number | undefined | null) {
  if (n == null) return '—'
  return Number.isInteger(n) ? `${n}h` : `${n.toFixed(1)}h`
}

const COMPLEXITY_TONE: Record<string, 'blue' | 'green' | 'amber' | 'red'> = {
  Baja: 'green',
  Media: 'blue',
  Alta: 'amber',
  Crítica: 'red',
}

const RISK_TONE: Record<string, 'green' | 'blue' | 'amber' | 'red'> = {
  Bajo: 'green',
  Medio: 'amber',
  Alto: 'red',
  Crítico: 'red',
}

const CATEGORY_LABELS: Record<string, string> = {
  analisis: 'Análisis',
  java: 'Java',
  cobol: 'COBOL',
  apigee: 'APIGEE',
  pruebas_tecnicas: 'Pruebas Técnicas',
  qa: 'QA',
  documentacion: 'Documentación',
  despliegue: 'Despliegue',
}

// ── Sub-components ────────────────────────────────────────────────────────────

function DriverRow({ d }: { d: EstimationDriver }) {
  return (
    <tr className="border-b border-gray-50 hover:bg-gray-50/50 text-xs">
      <td className="px-3 py-2 text-gray-700">{d.nombre}</td>
      <td className="px-3 py-2 text-center text-gray-500">{d.cantidad}</td>
      <td className="px-3 py-2 text-center text-gray-500">{fmt(d.horas_unitarias)}</td>
      <td className="px-3 py-2 text-right font-semibold text-allianz-blue">{fmt(d.total_horas)}</td>
      <td className="px-3 py-2 text-gray-400 hidden lg:table-cell">{d.descripcion ?? ''}</td>
    </tr>
  )
}

function CategorySection({
  label,
  category,
}: {
  label: string
  category: EstimationCategory
}) {
  const [open, setOpen] = useState(false)
  if (!category.drivers.length && category.subtotal === 0) return null

  return (
    <div className="border border-gray-100 rounded-lg overflow-hidden">
      <button
        onClick={() => setOpen((p) => !p)}
        className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          {open ? <ChevronDown size={14} className="text-gray-400" /> : <ChevronRight size={14} className="text-gray-400" />}
          <span className="text-sm font-semibold text-gray-700">{label}</span>
          <span className="text-xs text-gray-400">({category.drivers.length} driver{category.drivers.length !== 1 ? 's' : ''})</span>
        </div>
        <span className="text-sm font-bold text-allianz-blue">{fmt(category.subtotal)}</span>
      </button>

      {open && category.drivers.length > 0 && (
        <div className="border-t border-gray-100 overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-gray-50 text-[10px] font-medium uppercase text-gray-400">
                <th className="px-3 py-2 text-left">Driver</th>
                <th className="px-3 py-2 text-center">Cant.</th>
                <th className="px-3 py-2 text-center">H/Unit</th>
                <th className="px-3 py-2 text-right">Total</th>
                <th className="px-3 py-2 text-left hidden lg:table-cell">Descripción</th>
              </tr>
            </thead>
            <tbody>
              {category.drivers.map((d, i) => (
                <DriverRow key={i} d={d} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}

function ConsolidatedTable({ result }: { result: EstimacionResult }) {
  const rows: { label: string; value: number; highlight?: boolean }[] = [
    { label: 'Análisis', value: result.totales.total_analisis },
    { label: 'Construcción (Java + COBOL + APIGEE)', value: result.totales.total_construccion },
    { label: 'Pruebas Técnicas', value: result.totales.total_pruebas_tecnicas },
    { label: 'QA', value: result.totales.total_qa },
    { label: 'Documentación', value: result.totales.total_documentacion },
    { label: 'Despliegue', value: result.totales.total_despliegue },
    { label: `Riesgo (${result.factor_riesgo.nivel} +${result.factor_riesgo.porcentaje}%)`, value: result.factor_riesgo.horas_riesgo },
  ]

  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-allianz-blue text-white text-xs uppercase">
            <th className="px-4 py-3 text-left">Categoría</th>
            <th className="px-4 py-3 text-right">Horas</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={i}
              className={clsx(
                'border-b border-gray-100',
                i % 2 === 0 ? 'bg-white' : 'bg-gray-50/50',
                r.label.startsWith('Riesgo') && 'bg-amber-50',
              )}
            >
              <td className="px-4 py-2.5 text-gray-700">{r.label}</td>
              <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmt(r.value)}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-allianz-blue/10 border-t-2 border-allianz-blue">
            <td className="px-4 py-3 font-bold text-allianz-blue">TOTAL ESTIMACIÓN FINAL</td>
            <td className="px-4 py-3 text-right font-bold text-xl text-allianz-blue">{fmt(result.total_final)}</td>
          </tr>
        </tfoot>
      </table>
    </div>
  )
}

function ProfilesTable({ perfiles }: { perfiles: EstimacionResult['perfiles'] }) {
  const total = perfiles.reduce((s, p) => s + p.horas, 0)
  return (
    <div className="overflow-hidden rounded-lg border border-gray-200">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-gray-50 text-[10px] font-medium uppercase text-gray-400 border-b border-gray-200">
            <th className="px-4 py-2.5 text-left">Perfil</th>
            <th className="px-4 py-2.5 text-right">Horas</th>
            <th className="px-4 py-2.5 text-right">%</th>
          </tr>
        </thead>
        <tbody>
          {perfiles.filter((p) => p.horas > 0).map((p, i) => (
            <tr key={i} className="border-b border-gray-50 hover:bg-gray-50/50">
              <td className="px-4 py-2 text-gray-700 flex items-center gap-2">
                <Users size={12} className="text-allianz-blue" />
                {p.perfil}
              </td>
              <td className="px-4 py-2 text-right font-semibold text-gray-800">{fmt(p.horas)}</td>
              <td className="px-4 py-2 text-right text-gray-500 text-xs">
                {total > 0 ? `${((p.horas / total) * 100).toFixed(0)}%` : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function buildClipboardText(result: EstimacionResult): string {
  const line = (label: string, value: string) => `${label.padEnd(38)} ${value}`
  const sep = '─'.repeat(50)

  const lines: string[] = [
    `ESTIMACIÓN: ${result.titulo}`,
    `Fecha: ${new Date().toLocaleDateString('es-CO')}`,
    sep,
    result.resumen_requerimiento,
    '',
    '📊 TABLA CONSOLIDADA',
    sep,
    line('Categoría', 'Horas'),
    sep,
    line('Análisis', fmt(result.totales.total_analisis)),
    line('Construcción (Java + COBOL + APIGEE)', fmt(result.totales.total_construccion)),
    line('Pruebas Técnicas (10%)', fmt(result.totales.total_pruebas_tecnicas)),
    line('QA (10%)', fmt(result.totales.total_qa)),
    line('Documentación', fmt(result.totales.total_documentacion)),
    line('Despliegue', fmt(result.totales.total_despliegue)),
    line(`Riesgo ${result.factor_riesgo.nivel} (+${result.factor_riesgo.porcentaje}%)`, fmt(result.factor_riesgo.horas_riesgo)),
    sep,
    line('TOTAL FINAL', fmt(result.total_final)),
    '',
    `Complejidad: ${result.nivel_complejidad}`,
    `Riesgo: ${result.factor_riesgo.nivel} (${result.factor_riesgo.razones.join(', ')})`,
    '',
    '👥 PERFILES',
    sep,
    ...result.perfiles.filter((p) => p.horas > 0).map((p) => line(p.perfil, fmt(p.horas))),
    '',
    '📌 SUPUESTOS',
    ...result.supuestos.map((s) => `  • ${s}`),
    '',
    '📝 OBSERVACIONES',
    ...result.observaciones.map((o) => `  • ${o}`),
  ]

  return lines.join('\n')
}

// ── Main Page ─────────────────────────────────────────────────────────────────

const ACCEPTED = '.pdf,.doc,.docx,.xls,.xlsx,.xlsm,.csv,.txt,.md,.json,.xml,.html'

interface AttachedFile {
  name: string
  size: number
  text: string
  meta: Record<string, unknown>
}

function fileSizeLabel(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

type PageState = 'idle' | 'loading' | 'done' | 'error'

export function EstimationPage() {
  const [requerimiento, setRequerimiento] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [extracting, setExtracting] = useState(false)
  const [extractError, setExtractError] = useState<string | null>(null)
  const [incluirPi, setIncluirPi] = useState(false)
  const [state, setState] = useState<PageState>('idle')
  const [result, setResult] = useState<EstimacionResult | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fuenteAdicional = attachedFiles.map((f) => `[Archivo: ${f.name}]\n${f.text}`).join('\n\n---\n\n')
  const charCount = requerimiento.length + fuenteAdicional.length
  const willChunk = charCount > 9000

  async function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    if (!files.length) return
    setExtracting(true)
    setExtractError(null)

    const results: AttachedFile[] = []
    for (const file of files) {
      try {
        const { text, meta } = await extractFileText(file)
        results.push({ name: file.name, size: file.size, text, meta })
      } catch (err: unknown) {
        setExtractError(err instanceof Error ? err.message : `Error leyendo ${file.name}`)
      }
    }

    setAttachedFiles((prev) => [...prev, ...results])
    setExtracting(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  function removeFile(index: number) {
    setAttachedFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function handleEstimar() {
    if (!requerimiento.trim()) return
    setState('loading')
    setErrorMsg(null)
    setResult(null)

    try {
      const res = await generarEstimacion({
        requerimiento: requerimiento.trim(),
        fuente_adicional: fuenteAdicional || undefined,
        incluir_contexto_pi: incluirPi,
      })
      setResult(res)
      setState('done')
    } catch (e: unknown) {
      setErrorMsg(e instanceof Error ? e.message : 'Error desconocido')
      setState('error')
    }
  }

  function handleReset() {
    setState('idle')
    setResult(null)
    setErrorMsg(null)
  }

  async function handleCopy() {
    if (!result) return
    await navigator.clipboard.writeText(buildClipboardText(result))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  async function handleDownloadWord() {
    if (!result) return
    setDownloading(true)
    try {
      const blob = await exportEstimacionWord(result)
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `Estimacion_${result.titulo.replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 50)}.docx`
      a.click()
      URL.revokeObjectURL(url)
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message : 'Error descargando el documento')
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="h-full overflow-y-auto bg-corporate-surface">
      <PageHeader
        title="Estimación Paramétrica"
        subtitle="Genera estimaciones trazables, basadas en drivers reales, alineadas al modelo de horas del cliente"
        actions={
          state === 'done' ? (
            <div className="flex gap-2">
              <button
                onClick={handleCopy}
                className="flex items-center gap-1.5 text-sm border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors text-gray-600"
              >
                {copied ? <CheckCircle2 size={14} className="text-green-500" /> : <ClipboardCopy size={14} />}
                {copied ? 'Copiado' : 'Copiar'}
              </button>
              <button
                onClick={handleDownloadWord}
                disabled={downloading}
                className="flex items-center gap-1.5 text-sm border border-allianz-blue text-allianz-blue rounded-lg px-3 py-1.5 hover:bg-allianz-blue hover:text-white transition-colors disabled:opacity-50"
              >
                {downloading
                  ? <Loader2 size={14} className="animate-spin" />
                  : <Download size={14} />}
                {downloading ? 'Generando…' : 'Descargar Word'}
              </button>
              <button
                onClick={handleReset}
                className="flex items-center gap-1.5 text-sm text-white bg-allianz-blue hover:bg-allianz-light rounded-lg px-3 py-1.5 transition-colors"
              >
                <Plus size={14} /> Nueva estimación
              </button>
            </div>
          ) : undefined
        }
      />

      <div className="mx-auto max-w-5xl space-y-4 p-4">

        {/* ── Input Form ── */}
        {state !== 'done' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-100 px-5 py-4 flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-corporate-surface text-allianz-blue">
                <FileText size={15} />
              </div>
              <div>
                <h2 className="text-sm font-semibold text-gray-800">Requerimiento a estimar</h2>
                <p className="text-[11px] text-gray-400">
                  Describe el requerimiento con el mayor detalle posible. Puedes pegar texto desde Jira, correos, especificaciones, etc.
                </p>
              </div>
            </div>

            <div className="p-5 space-y-4">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1.5">
                  Descripción del requerimiento *
                </label>
                <textarea
                  value={requerimiento}
                  onChange={(e) => setRequerimiento(e.target.value)}
                  rows={8}
                  placeholder={`Ejemplo:\n"Implementar un nuevo servicio REST en Java que consulte el módulo COBOL PGMCUST para validar datos del cliente. El servicio debe exponerse vía APIGEE con autenticación OAuth. Se requiere modificar el COPYBOOK CPYCUST y crear un JCL para el proceso batch de conciliación nocturna..."`}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2.5 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-allianz-blue/30 placeholder:text-gray-300"
                />
                <p className="mt-1 text-[10px] text-gray-400">{requerimiento.length} caracteres</p>
              </div>

              {/* Archivos adicionales */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-gray-600">
                    Archivos adicionales
                    <span className="ml-1 text-gray-400 font-normal">(opcional — PDF, Word, Excel, CSV, TXT…)</span>
                  </p>
                  {willChunk && (
                    <span className="text-[10px] text-amber-600 flex items-center gap-1">
                      <AlertTriangle size={10} /> Entrada extensa — se aplicará chunking
                    </span>
                  )}
                </div>

                {/* Upload zone */}
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className={clsx(
                    'relative flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed px-4 py-5 cursor-pointer transition-colors',
                    extracting
                      ? 'border-allianz-blue/40 bg-blue-50/50'
                      : 'border-gray-200 hover:border-allianz-blue/50 hover:bg-blue-50/30',
                  )}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept={ACCEPTED}
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  {extracting ? (
                    <>
                      <Loader2 size={20} className="animate-spin text-allianz-blue" />
                      <p className="text-xs text-allianz-blue font-medium">Extrayendo texto…</p>
                    </>
                  ) : (
                    <>
                      <Upload size={20} className="text-gray-300" />
                      <p className="text-xs text-gray-500 text-center">
                        <span className="font-medium text-allianz-blue">Haz clic para subir</span>
                        {' '}o arrastra archivos aquí
                      </p>
                      <p className="text-[10px] text-gray-400">PDF · Word · Excel · CSV · TXT · JSON — máx. 20 MB por archivo</p>
                    </>
                  )}
                </div>

                {/* Drag & drop support */}
                {/* Attached files list */}
                {attachedFiles.length > 0 && (
                  <div className="space-y-1.5">
                    {attachedFiles.map((f, i) => (
                      <div
                        key={i}
                        className="flex items-center justify-between gap-2 rounded-lg border border-gray-100 bg-white px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Paperclip size={13} className="flex-shrink-0 text-allianz-blue" />
                          <div className="min-w-0">
                            <p className="text-xs font-medium text-gray-700 truncate">{f.name}</p>
                            <p className="text-[10px] text-gray-400">
                              {fileSizeLabel(f.size)}
                              {f.meta.paginas ? ` · ${f.meta.paginas} páginas` : ''}
                              {f.meta.hojas ? ` · ${f.meta.hojas} hoja(s)` : ''}
                              {f.meta.filas ? ` · ${f.meta.filas} filas` : ''}
                              {' · '}
                              <span className="text-green-600">{f.text.length.toLocaleString()} chars extraídos</span>
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={() => removeFile(i)}
                          className="flex-shrink-0 text-gray-300 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                {extractError && (
                  <p className="text-[11px] text-red-600 flex items-center gap-1">
                    <AlertTriangle size={11} /> {extractError}
                  </p>
                )}
              </div>

              {/* PI context toggle */}
              <label className="flex items-start gap-2.5 cursor-pointer group">
                <div className="pt-0.5">
                  <input
                    type="checkbox"
                    checked={incluirPi}
                    onChange={(e) => setIncluirPi(e.target.checked)}
                    className="w-3.5 h-3.5 rounded accent-allianz-blue"
                  />
                </div>
                <div>
                  <span className="text-sm font-medium text-gray-700 group-hover:text-gray-900">
                    Enriquecer con contexto del PI activo
                  </span>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    Incluye el backlog registrado en el PI para estimar con mayor precisión frente a la carga existente.
                  </p>
                </div>
              </label>

              {state === 'error' && errorMsg && (
                <div className="flex items-start gap-2 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                  <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
                  <span>{errorMsg}</span>
                </div>
              )}

              <button
                onClick={handleEstimar}
                disabled={state === 'loading' || !requerimiento.trim()}
                className="flex items-center gap-2 text-sm text-white bg-allianz-blue hover:bg-allianz-light rounded-lg px-5 py-2 disabled:opacity-40 transition-colors font-medium"
              >
                {state === 'loading' ? (
                  <>
                    <Loader2 size={15} className="animate-spin" />
                    {willChunk ? 'Procesando fragmentos…' : 'Generando estimación…'}
                  </>
                ) : (
                  <>
                    <Sparkles size={15} />
                    Generar estimación
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* ── Loading ── */}
        {state === 'loading' && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 flex flex-col items-center gap-4 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-blue-50">
              <Loader2 size={24} className="animate-spin text-allianz-blue" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700">Analizando y estimando…</p>
              <p className="text-xs text-gray-400 mt-1">
                El agente está mapeando drivers, calculando horas por categoría y aplicando factores de riesgo.
                {willChunk && ' Se está procesando la información en fragmentos.'}
              </p>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {state === 'done' && result && (
          <div className="space-y-4">

            {/* Title + summary */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <CheckCircle2 size={16} className="text-green-500 flex-shrink-0" />
                    <h2 className="text-base font-bold text-gray-800 truncate">{result.titulo}</h2>
                  </div>
                  <p className="text-sm text-gray-600 leading-relaxed">{result.resumen_requerimiento}</p>
                </div>
                <button
                  onClick={handleReset}
                  className="flex-shrink-0 flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-50 transition-colors"
                >
                  <RefreshCw size={12} /> Nueva
                </button>
              </div>
            </div>

            {/* KPI cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <KpiCard
                label="Total Final"
                value={fmt(result.total_final)}
                icon={Clock}
                tone="blue"
                detail={`Sin riesgo: ${fmt(result.totales.subtotal_sin_riesgo)}`}
              />
              <KpiCard
                label="Construcción"
                value={fmt(result.totales.total_construccion)}
                icon={Layers}
                tone="neutral"
                detail={`Análisis: ${fmt(result.totales.total_analisis)}`}
              />
              <div className="corporate-panel px-4 py-3">
                <p className="text-[11px] font-medium uppercase text-corporate-muted">Complejidad</p>
                <div className="mt-1 flex items-center gap-2">
                  <Zap size={18} className="text-corporate-muted" />
                  <StatusBadge
                    tone={COMPLEXITY_TONE[result.nivel_complejidad] ?? 'neutral'}
                  >
                    {result.nivel_complejidad}
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-corporate-muted">
                  {result.totales.total_construccion}h construcción
                </p>
              </div>
              <div className="corporate-panel px-4 py-3">
                <p className="text-[11px] font-medium uppercase text-corporate-muted">Riesgo</p>
                <div className="mt-1 flex items-center gap-2">
                  <ShieldAlert size={18} className="text-corporate-muted" />
                  <StatusBadge tone={RISK_TONE[result.factor_riesgo.nivel] ?? 'neutral'}>
                    {result.factor_riesgo.nivel} +{result.factor_riesgo.porcentaje}%
                  </StatusBadge>
                </div>
                <p className="mt-1 text-xs text-corporate-muted">+{fmt(result.factor_riesgo.horas_riesgo)}</p>
              </div>
            </div>

            <div className="grid lg:grid-cols-2 gap-4">

              {/* Consolidated table */}
              <DataPanel
                title="Tabla Consolidada (Tipo Cliente)"
                icon={BarChart3}
              >
                <div className="p-4">
                  <ConsolidatedTable result={result} />
                </div>
              </DataPanel>

              {/* Profiles + Risk */}
              <div className="space-y-4">
                <DataPanel title="Distribución por Perfiles" icon={Users}>
                  <div className="p-4">
                    <ProfilesTable perfiles={result.perfiles} />
                  </div>
                </DataPanel>

                {result.factor_riesgo.razones.length > 0 && (
                  <DataPanel title="Factores de Riesgo Identificados" icon={ShieldAlert}>
                    <div className="p-4">
                      <ul className="space-y-1.5">
                        {result.factor_riesgo.razones.map((r, i) => (
                          <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                            <AlertTriangle
                              size={12}
                              className={clsx(
                                'flex-shrink-0 mt-0.5',
                                result.factor_riesgo.nivel === 'Crítico' ? 'text-red-500' :
                                result.factor_riesgo.nivel === 'Alto' ? 'text-orange-500' :
                                result.factor_riesgo.nivel === 'Medio' ? 'text-amber-500' : 'text-gray-400',
                              )}
                            />
                            {r}
                          </li>
                        ))}
                      </ul>
                    </div>
                  </DataPanel>
                )}
              </div>
            </div>

            {/* Driver breakdown by category */}
            <DataPanel
              title="Detalle de Drivers por Categoría"
              description="Haz clic en una categoría para ver el desglose completo de drivers"
              icon={Layers}
            >
              <div className="p-4 space-y-2">
                {Object.entries(result.categorias).map(([key, cat]) => (
                  <CategorySection
                    key={key}
                    label={CATEGORY_LABELS[key] ?? key}
                    category={cat}
                  />
                ))}
              </div>
            </DataPanel>

            {/* Assumptions & Observations */}
            {(result.supuestos.length > 0 || result.observaciones.length > 0) && (
              <div className="grid sm:grid-cols-2 gap-4">
                {result.supuestos.length > 0 && (
                  <DataPanel title="Supuestos" icon={CheckCircle2}>
                    <ul className="p-4 space-y-1.5">
                      {result.supuestos.map((s, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="flex-shrink-0 text-allianz-blue font-bold mt-0.5">•</span>
                          {s}
                        </li>
                      ))}
                    </ul>
                  </DataPanel>
                )}

                {result.observaciones.length > 0 && (
                  <DataPanel title="Observaciones" icon={AlertTriangle}>
                    <ul className="p-4 space-y-1.5">
                      {result.observaciones.map((o, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
                          <span className="flex-shrink-0 text-amber-500 font-bold mt-0.5">•</span>
                          {o}
                        </li>
                      ))}
                    </ul>
                  </DataPanel>
                )}
              </div>
            )}

          </div>
        )}
      </div>
    </div>
  )
}
