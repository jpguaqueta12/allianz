import { useEffect, useCallback } from 'react'
import { getFabricaDashboard } from '../services/api'
import { useFabricaStore } from '../stores/fabricaStore'

export function useFabrica(autoRefreshMs = 30_000, piId?: number | null) {
  const { setData, setLoading, setError } = useFabricaStore()

  const refresh = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getFabricaDashboard(piId)
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
