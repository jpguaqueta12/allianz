import { useEffect, useCallback } from 'react'
import { getIncidentesDashboard } from '../services/api'
import { useIncidentesStore } from '../stores/incidentesStore'

export function useIncidentes(autoRefreshMs = 30_000) {
  const { setData, setLoading, setError } = useIncidentesStore()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getIncidentesDashboard()
      setData(data)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Error desconocido')
    }
  }, [setData, setLoading, setError])

  useEffect(() => {
    refresh()
    const interval = setInterval(refresh, autoRefreshMs)
    return () => clearInterval(interval)
  }, [refresh, autoRefreshMs])

  return { refresh }
}
