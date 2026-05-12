import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface AuthState {
  token: string | null
  isSuperUser: boolean
  login: (token: string) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      isSuperUser: false,
      login: (token) => set({ token, isSuperUser: true }),
      logout: () => set({ token: null, isSuperUser: false }),
    }),
    { name: 'auth-storage' },
  ),
)
