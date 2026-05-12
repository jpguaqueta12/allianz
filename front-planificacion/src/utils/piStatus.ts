import { PiInfo } from '../types'

type BadgeTone = 'blue' | 'red' | 'green' | 'amber' | 'neutral' | 'purple'

export interface PiDisplayState {
  label: string
  tone: BadgeTone
}

function todayIso(): string {
  const d = new Date()
  const year = d.getFullYear()
  const month = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function getPiDisplayState(pi: PiInfo): PiDisplayState {
  if (pi.estado === 'CERRADO') return { label: 'Cerrado', tone: 'neutral' }

  const today = todayIso()
  if (today < pi.fecha_inicio) return { label: 'Planificado', tone: 'blue' }
  if (today > pi.fecha_fin) {
    return pi.activo
      ? { label: 'Activo vencido', tone: 'red' }
      : { label: 'Vencido', tone: 'red' }
  }
  return { label: 'Vigente', tone: 'green' }
}

export function buildModulePiTitle(moduleName: string, pi: PiInfo | null): string {
  if (!pi) return moduleName
  const state = getPiDisplayState(pi)
  return `${moduleName} · ${pi.nombre} · ${state.label}`
}
