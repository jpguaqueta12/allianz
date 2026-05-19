import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Role = 'superuser' | 'user' | null

interface AuthState {
  token: string | null
  role: Role
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
      isSuperUser: false,
      isAuthenticated: false,
      login: (token, role) => set({
        token,
        role,
        isSuperUser: role === 'superuser',
        isAuthenticated: true,
      }),
      setRole: (role) => set({
        role,
        isSuperUser: role === 'superuser',
        isAuthenticated: !!get().token,
      }),
      logout: () => set({
        token: null,
        role: null,
        isSuperUser: false,
        isAuthenticated: false,
      }),
      isSessionExpired: () => {
        const { token } = get()
        return !token
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        token: state.token,
        role: state.role,
        isSuperUser: state.isSuperUser,
        isAuthenticated: state.isAuthenticated,
      }),
    },
  ),
)
