import { useEffect, useState } from 'react'
import { Loader2, AlertCircle, RefreshCw, Eye, X } from 'lucide-react'
import clsx from 'clsx'
import { IncidenteItem } from '../../types'
import { getBacklog } from '../../services/api'

const ESTADO_COLOR: Record<string, string> = {
  'Asigned':                 'text-blue-700 bg-blue-50 border-blue-200',
  'In Progress':             'text-amber-700 bg-amber-50 border-amber-200',
  'Resolved':                'text-green-700 bg-green-50 border-green-200',
  'Closed':                  'text-gray-500 bg-gray-50 border-gray-200',
  'Customer Info Required':  'text-orange-700 bg-orange-50 border-orange-200',
  'Pending':                 'text-purple-700 bg-purple-50 border-purple-200',
}

const PAGE_SIZE_OPTIONS = [10, 25, 50, 100]

function Badge({ value, colorMap }: { value: string | null; colorMap: Record<string, string> }) {
  if (!value) return <span className="text-corporate-muted">—</span>
  const cls = colorMap[value] ?? 'text-corporate-muted bg-corporate-surface border-corporate-line'
  return (
    <span className={clsx('inline-flex max-w-full items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight whitespace-normal break-words', cls)}>
      {value}
    </span>
  )
}

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <p className="text-[11px] font-medium uppercase text-corporate-muted">{label}</p>
      <div className="mt-1 min-h-[24px] rounded border border-corporate-line bg-corporate-surface px-2 py-1.5 text-xs text-corporate-ink break-words">
        {value || <span className="text-corporate-muted">—</span>}
      </div>
    </div>
  )
}

function IncidenteDetailModal({ item, onClose }: { item: IncidenteItem; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="w-full max-w-2xl rounded-xl border border-corporate-line bg-white shadow-2xl">
        <div className="flex items-start justify-between gap-4 border-b border-corporate-line px-5 py-4">
          <div>
            <p className="font-mono text-xs font-semibold text-allianz-blue">{item.numero ?? '—'}</p>
            <p className="mt-1 text-sm font-semibold text-corporate-ink">{item.equipo ?? 'Sin equipo'}</p>
          </div>
          <button onClick={onClose} className="rounded p-1.5 text-corporate-muted hover:bg-corporate-surface hover:text-corporate-ink">
            <X size={16} />
          </button>
        </div>
        <div className="max-h-[72vh] overflow-y-auto p-5">
          <div className="grid gap-3 md:grid-cols-2">
            <DetailField label="Estado SN" value={<Badge value={item.estado_sn} colorMap={ESTADO_COLOR} />} />
            <DetailField label="Jira" value={item.jira} />
            <DetailField label="Fecha escalado SN" value={item.fecha_escalado} />
            <DetailField label="Fecha respuesta" value={item.fecha_respuesta} />
            <DetailField label="Días" value={item.dias ?? null} />
            <DetailField label="Equipo" value={item.equipo} />
          </div>
          <div className="mt-3">
            <DetailField label="Comentario" value={item.comentario} />
          </div>
        </div>
      </div>
    </div>
  )
}

function PaginationControls({
  page,
  pageCount,
  pageSize,
  total,
  start,
  end,
  onPageChange,
  onPageSizeChange,
}: {
  page: number
  pageCount: number
  pageSize: number
  total: number
  start: number
  end: number
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-corporate-line bg-white px-3 py-2">
      <span className="text-xs text-corporate-muted">
        {total > 0 ? `${start}-${end} de ${total}` : '0 resultados'}
      </span>
      <div className="flex items-center gap-2">
        <select
          value={pageSize}
          onChange={e => onPageSizeChange(Number(e.target.value))}
          className="rounded border border-corporate-line bg-white px-2 py-1 text-xs text-corporate-ink"
        >
          {PAGE_SIZE_OPTIONS.map(size => (
            <option key={size} value={size}>{size} por página</option>
          ))}
        </select>
        <button
          onClick={() => onPageChange(Math.max(1, page - 1))}
          disabled={page <= 1}
          className="rounded border border-corporate-line px-2.5 py-1 text-xs text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
        >
          Anterior
        </button>
        <span className="min-w-[70px] text-center text-xs font-medium text-corporate-ink">
          {page}/{pageCount}
        </span>
        <button
          onClick={() => onPageChange(Math.min(pageCount, page + 1))}
          disabled={page >= pageCount}
          className="rounded border border-corporate-line px-2.5 py-1 text-xs text-corporate-muted hover:text-corporate-ink disabled:opacity-40"
        >
          Siguiente
        </button>
      </div>
    </div>
  )
}

interface Props {
  active: boolean
}

export function BacklogIncidentesPanel({ active }: Props) {
  const [items, setItems]     = useState<IncidenteItem[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]     = useState<string | null>(null)
  const [loaded, setLoaded]   = useState(false)
  const [search, setSearch]   = useState('')
  const [viewing, setViewing] = useState<IncidenteItem | null>(null)
  const [page, setPage]       = useState(1)
  const [pageSize, setPageSize] = useState(25)

  async function load() {
    setLoading(true)
    setError(null)
    try {
      const data = await getBacklog('INCIDENTES')
      setItems(data)
      setLoaded(true)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error cargando backlog de incidentes')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (active && !loaded) load()
  }, [active])

  const filtered = items.filter(item =>
    !search ||
    (item.numero ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (item.equipo ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (item.estado_sn ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (item.jira ?? '').toLowerCase().includes(search.toLowerCase()) ||
    (item.comentario ?? '').toLowerCase().includes(search.toLowerCase())
  )
  const pageCount = Math.max(1, Math.ceil(filtered.length / pageSize))
  const currentPage = Math.min(page, pageCount)
  const pageStartIndex = (currentPage - 1) * pageSize
  const pageItems = filtered.slice(pageStartIndex, pageStartIndex + pageSize)
  const resultStart = filtered.length > 0 ? pageStartIndex + 1 : 0
  const resultEnd = Math.min(pageStartIndex + pageSize, filtered.length)

  useEffect(() => {
    setPage(1)
  }, [search, pageSize, items.length])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 gap-2 text-corporate-muted">
        <Loader2 size={20} className="animate-spin" /> Cargando incidentes…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-red-200 bg-red-50 px-4 py-3">
        <AlertCircle size={16} className="text-red-600" />
        <span className="text-sm text-red-700">{error}</span>
        <button onClick={load} className="ml-auto flex items-center gap-1 text-xs text-red-600 hover:text-red-800">
          <RefreshCw size={12} /> Reintentar
        </button>
      </div>
    )
  }

  if (loaded && items.length === 0) {
    return (
      <div className="flex flex-col items-center gap-3 py-16 text-center">
        <p className="text-sm font-medium text-corporate-ink">Sin incidentes en el backlog</p>
        <p className="text-xs text-corporate-muted">Sube un archivo Excel desde <strong>Subir Incidentes</strong> para poblar el backlog.</p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {viewing && <IncidenteDetailModal item={viewing} onClose={() => setViewing(null)} />}

      <div className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Buscar por número, equipo, estado, Jira…"
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="flex-1 rounded border border-corporate-line bg-white px-3 py-1.5 text-xs text-corporate-ink placeholder:text-corporate-muted"
        />
        <span className="text-xs text-corporate-muted whitespace-nowrap">
          {filtered.length} de {items.length} incidente{items.length !== 1 ? 's' : ''}
        </span>
        <button onClick={load} disabled={loading} className="flex items-center gap-1 rounded border border-corporate-line bg-white px-2.5 py-1.5 text-xs text-corporate-muted hover:text-corporate-ink">
          <RefreshCw size={12} /> Actualizar
        </button>
      </div>

      <PaginationControls
        page={currentPage}
        pageCount={pageCount}
        pageSize={pageSize}
        total={filtered.length}
        start={resultStart}
        end={resultEnd}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />

      <div className="overflow-hidden rounded-lg border border-corporate-line">
        <table className="corporate-table table-fixed">
          <thead>
            <tr>
              <th className="w-32">Numero</th>
              <th className="w-44">Estado SN</th>
              <th className="w-44">Equipo</th>
              <th className="w-32">Jira</th>
              <th>Comentario</th>
              <th className="w-20 text-right">Días</th>
              <th className="w-24 text-center">Detalle</th>
            </tr>
          </thead>
          <tbody>
            {pageItems.map(item => (
              <tr key={item.id} className="hover:bg-corporate-surface">
                <td className="font-mono text-xs font-semibold text-allianz-blue whitespace-nowrap">
                  {item.numero ?? '—'}
                </td>
                <td><Badge value={item.estado_sn} colorMap={ESTADO_COLOR} /></td>
                <td className="max-w-[180px] truncate text-xs text-corporate-muted" title={item.equipo ?? ''}>{item.equipo ?? '—'}</td>
                <td className="font-mono text-xs text-allianz-blue whitespace-nowrap">{item.jira ?? '—'}</td>
                <td>
                  <span className="line-clamp-2 text-xs text-corporate-ink" title={item.comentario ?? ''}>{item.comentario ?? '—'}</span>
                </td>
                <td className="text-right font-mono text-xs font-semibold text-corporate-ink">{item.dias ?? '—'}</td>
                <td className="text-center">
                  <button
                    onClick={() => setViewing(item)}
                    title="Ver detalle"
                    className="inline-flex h-7 items-center gap-1 rounded-lg px-2 text-xs font-medium text-corporate-muted hover:bg-corporate-surface hover:text-allianz-blue"
                  >
                    <Eye size={14} />
                    Ver
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <PaginationControls
        page={currentPage}
        pageCount={pageCount}
        pageSize={pageSize}
        total={filtered.length}
        start={resultStart}
        end={resultEnd}
        onPageChange={setPage}
        onPageSizeChange={setPageSize}
      />
    </div>
  )
}
