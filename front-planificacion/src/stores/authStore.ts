import { create } from 'zustand'
import { persist } from 'zustand/middleware'

type Role = 'superuser' | 'user' | null

interface AuthState {
  token: string | null
  role: Role
  isSuperUser: boolean
  isAuthenticated: boolean
  login: (token: string, role: Role) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
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
      logout: () => set({ token: null, role: null, isSuperUser: false, isAuthenticated: false }),
    }),
    { name: 'auth-storage' },
  ),
)
