import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Lock, User, Eye, EyeOff, Loader2 } from 'lucide-react'
import { useAuthStore } from '../stores/authStore'
import { loginSuperUser } from '../services/api'

export function LoginPage() {
  const { login, isAuthenticated } = useAuthStore()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Si ya está autenticado, redirigir al dashboard
  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { access_token } = await loginSuperUser(username, password)
      // Decodificar el rol del JWT (payload.sub)
      const payload = JSON.parse(atob(access_token.split('.')[1]))
      const role = payload.sub === 'superuser' ? 'superuser' : 'user'
      login(access_token, role)
      navigate(role === 'superuser' ? '/config' : '/', { replace: true })
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Credenciales incorrectas')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex h-screen items-center justify-center bg-corporate-surface">
      <div className="w-full max-w-sm">
        {/* Logo / cabecera */}
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-xl bg-allianz-blue text-white text-xl font-bold shadow-md">
            ND
          </div>
          <h1 className="text-xl font-semibold text-corporate-ink">Acceso de Administrador</h1>
          <p className="mt-1 text-sm text-corporate-muted">Solo el superusuario puede gestionar PIs</p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="rounded-xl border border-corporate-line bg-white p-8 shadow-sm"
        >
          {/* Usuario */}
          <div className="mb-4">
            <label className="mb-1.5 block text-xs font-medium text-corporate-muted uppercase tracking-wide">
              Usuario
            </label>
            <div className="relative">
              <User size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-corporate-muted" />
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                className="w-full rounded-lg border border-corporate-line py-2.5 pl-9 pr-4 text-sm text-corporate-ink outline-none transition focus:border-allianz-blue focus:ring-1 focus:ring-allianz-blue"
                placeholder="admin"
              />
            </div>
          </div>

          {/* Contraseña */}
          <div className="mb-6">
            <label className="mb-1.5 block text-xs font-medium text-corporate-muted uppercase tracking-wide">
              Contraseña
            </label>
            <div className="relative">
              <Lock size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-corporate-muted" />
              <input
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                className="w-full rounded-lg border border-corporate-line py-2.5 pl-9 pr-10 text-sm text-corporate-ink outline-none transition focus:border-allianz-blue focus:ring-1 focus:ring-allianz-blue"
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-corporate-muted hover:text-corporate-ink"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="flex w-full items-center justify-center gap-2 rounded-lg bg-allianz-blue py-2.5 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : <Lock size={16} />}
            {loading ? 'Verificando...' : 'Iniciar sesión'}
          </button>
        </form>
      </div>
    </div>
  )
}
