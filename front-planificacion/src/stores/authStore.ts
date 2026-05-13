import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Role = 'superuser' | 'user' | null
export const SESSION_TTL_MS = 60 * 60 * 1000

interface AuthState {
  token: string | null
  role: Role
  expiresAt: number | null
  isSuperUser: boolean
  isAuthenticated: boolean
  login: (token: string, role: Role) => void
  setRole: (role: Role) => void
  logout: () => void
  isSessionExpired: () => boolean
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      role: null,
      expiresAt: null,
      isSuperUser: false,
      isAuthenticated: false,
      login: (token, role) => set({
        token,
        role,
        expiresAt: Date.now() + SESSION_TTL_MS,
        isSuperUser: role === 'superuser',
        isAuthenticated: true,
      }),
      setRole: (role) => set({
        role,
        isSuperUser: role === 'superuser',
        isAuthenticated: !!get().token && !get().isSessionExpired(),
      }),
      logout: () => set({
        token: null,
        role: null,
        expiresAt: null,
        isSuperUser: false,
        isAuthenticated: false,
      }),
      isSessionExpired: () => {
        const { token, expiresAt } = get()
        return !token || !expiresAt || Date.now() >= expiresAt
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        role: state.role,
        expiresAt: state.expiresAt,
        isSuperUser: state.isSuperUser,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
