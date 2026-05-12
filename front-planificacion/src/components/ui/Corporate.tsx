import clsx from 'clsx'
import { LucideIcon } from 'lucide-react'
import { ReactNode } from 'react'

interface PageHeaderProps {
  title: string
  subtitle?: string
  meta?: ReactNode
  actions?: ReactNode
}

export function PageHeader({ title, subtitle, meta, actions }: PageHeaderProps) {
  return (
    <header className="sticky top-0 z-30 border-b border-corporate-line bg-white/95 px-4 py-3 backdrop-blur supports-[backdrop-filter]:bg-white/85">
      <div className="flex flex-col gap-2">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div className="min-w-0">
            <h1 className="truncate text-base font-semibold leading-tight text-corporate-ink" title={title}>{title}</h1>
            {subtitle && <p className="mt-0.5 truncate text-xs text-corporate-muted">{subtitle}</p>}
          </div>
          {actions && <div className="flex shrink-0 flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
        </div>
        {meta && <div className="flex flex-wrap items-center gap-1.5">{meta}</div>}
      </div>
    </header>
  )
}

interface DataPanelProps {
  title?: string
  description?: string
  icon?: LucideIcon
  action?: ReactNode
  children: ReactNode
  className?: string
}

export function DataPanel({ title, description, icon: Icon, action, children, className }: DataPanelProps) {
  return (
    <section className={clsx('corporate-panel', className)}>
      {(title || description || action) && (
        <div className="flex items-start justify-between gap-3 border-b border-corporate-line px-4 py-3">
          <div className="flex min-w-0 items-start gap-2">
            {Icon && (
              <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-md bg-corporate-surface text-allianz-blue">
                <Icon size={15} />
              </div>
            )}
            <div className="min-w-0">
              {title && <h2 className="text-sm font-semibold text-corporate-ink">{title}</h2>}
              {description && <p className="mt-0.5 text-xs text-corporate-muted">{description}</p>}
            </div>
          </div>
          {action}
        </div>
      )}
      {children}
    </section>
  )
}

interface KpiCardProps {
  label: string
  value: number | string | null
  icon: LucideIcon
  tone?: 'blue' | 'red' | 'green' | 'amber' | 'neutral'
  detail?: string
}

const toneClass = {
  blue: 'text-allianz-blue bg-blue-50 border-blue-100',
  red: 'text-red-700 bg-red-50 border-red-100',
  green: 'text-green-700 bg-green-50 border-green-100',
  amber: 'text-amber-700 bg-amber-50 border-amber-100',
  neutral: 'text-corporate-muted bg-corporate-surface border-corporate-line',
}

export function KpiCard({ label, value, icon: Icon, tone = 'neutral', detail }: KpiCardProps) {
  return (
    <div className="corporate-panel px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-medium uppercase text-corporate-muted">{label}</p>
          <p className="mt-1 text-2xl font-semibold text-corporate-ink">{value ?? '-'}</p>
          {detail && <p className="mt-1 text-xs text-corporate-muted">{detail}</p>}
        </div>
        <div className={clsx('flex h-9 w-9 items-center justify-center rounded-md border', toneClass[tone])}>
          <Icon size={18} />
        </div>
      </div>
    </div>
  )
}

interface StatusBadgeProps {
  children: ReactNode
  tone?: 'blue' | 'red' | 'green' | 'amber' | 'neutral' | 'purple'
  className?: string
}

const badgeClass = {
  blue: 'bg-blue-50 text-blue-800 border-blue-100',
  red: 'bg-red-50 text-red-800 border-red-100',
  green: 'bg-green-50 text-green-800 border-green-100',
  amber: 'bg-amber-50 text-amber-800 border-amber-100',
  neutral: 'bg-corporate-surface text-corporate-muted border-corporate-line',
  purple: 'bg-violet-50 text-violet-800 border-violet-100',
}

export function StatusBadge({ children, tone = 'neutral', className }: StatusBadgeProps) {
  return (
    <span className={clsx('inline-flex items-center rounded border px-1.5 py-0.5 text-[11px] font-medium leading-tight', badgeClass[tone], className)}>
      {children}
    </span>
  )
}

interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  label: string
  active?: boolean
}

export function IconButton({ icon: Icon, label, active, className, ...props }: IconButtonProps) {
  return (
    <button
      {...props}
      title={label}
      aria-label={label}
      className={clsx(
        'inline-flex h-9 w-9 items-center justify-center rounded-md border transition-colors',
        active
          ? 'border-allianz-blue bg-allianz-blue text-white'
          : 'border-corporate-line bg-white text-corporate-muted hover:border-allianz-blue hover:text-allianz-blue',
        props.disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <Icon size={16} />
    </button>
  )
}
