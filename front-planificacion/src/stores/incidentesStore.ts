import { create } from 'zustand'
import { DashboardData } from '../types'

interface IncidentesStore {
  data: DashboardData | null
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  setData: (d: DashboardData) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useIncidentesStore = create<IncidentesStore>((set) => ({
  data: null,
  loading: false,
  error: null,
  lastRefresh: null,
  setData: (data) => set({ data, lastRefresh: new Date(), error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}))
