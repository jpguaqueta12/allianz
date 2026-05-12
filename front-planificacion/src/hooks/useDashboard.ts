import { useEffect, useCallback } from 'react'
import { getDashboard } from '../services/api'
import { useDashboardStore } from '../stores/dashboardStore'

export function useDashboard(autoRefreshMs = 30_000, piId?: number | null) {
  const { setData, setLoading, setError } = useDashboardStore()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getDashboard(piId)
      setData(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
  }, [setData, setLoading, setError, piId])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, autoRefreshMs)
    return () => clearInterval(interval)
  }, [refresh, autoRefreshMs])

  return { refresh }
}
