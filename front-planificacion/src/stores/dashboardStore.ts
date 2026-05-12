import { create } from 'zustand'
import { DashboardData } from '../types'

interface DashboardStore {
  data: DashboardData | null
  loading: boolean
  error: string | null
  lastRefresh: Date | null
  setData: (d: DashboardData) => void
  setLoading: (v: boolean) => void
  setError: (e: string | null) => void
}

export const useDashboardStore = create<DashboardStore>((set) => ({
  data: null,
  loading: false,
  error: null,
  lastRefresh: null,
  setData: (data) => set({ data, lastRefresh: new Date(), error: null }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error, loading: false }),
}))
