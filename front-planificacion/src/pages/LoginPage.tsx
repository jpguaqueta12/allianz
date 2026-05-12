import { useState, FormEvent } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { Eye, EyeOff, Loader2, ArrowRight } from 'lucide-react'
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

  if (isAuthenticated) return <Navigate to="/" replace />

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      const { access_token } = await loginSuperUser(username, password)
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
    <div className="relative flex h-screen w-full overflow-hidden bg-[#03112a]">
      {/* Fondo con gradiente animado */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-allianz-blue opacity-10 blur-[120px]" />
        <div className="absolute -bottom-40 -right-20 h-[500px] w-[500px] rounded-full bg-blue-400 opacity-10 blur-[100px]" />
      </div>

      {/* Panel izquierdo — branding */}
      <div className="relative hidden flex-1 flex-col justify-between p-12 lg:flex">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-allianz-blue text-sm font-bold text-white">
            ND
          </div>
          <span className="text-sm font-semibold tracking-wide text-white/80">NTT DATA</span>
        </div>

        <div>
          <p className="mb-4 text-sm font-medium uppercase tracking-widest text-allianz-blue">
            Planificador de PIs
          </p>
          <h1 className="text-5xl font-bold leading-tight text-white">
            Bienvenido<br />de vuelta
          </h1>
          <p className="mt-4 max-w-sm text-base text-white/50">
            Gestiona la capacidad, backlog y planificación de sprints de Allianz en un solo lugar.
          </p>
        </div>

        <p className="text-xs text-white/25">© 2026 NTT DATA · Allianz</p>
      </div>

      {/* Panel derecho — formulario */}
      <div className="relative flex w-full flex-col items-center justify-center px-6 lg:w-[460px] lg:border-l lg:border-white/5 lg:bg-white/[0.02] lg:px-14">
        {/* Logo móvil */}
        <div className="mb-8 flex items-center gap-3 lg:hidden">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-allianz-blue text-sm font-bold text-white">
            ND
          </div>
          <span className="text-sm font-semibold text-white/80">NTT DATA</span>
        </div>

        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-bold text-white">Iniciar sesión</h2>
          <p className="mt-1 text-sm text-white/40">Introduce tus credenciales para continuar</p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-4">
            {/* Usuario */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/40">
                Usuario
              </label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                required
                placeholder="admin"
                className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder-white/20 outline-none transition focus:border-allianz-blue focus:ring-1 focus:ring-allianz-blue"
              />
            </div>

            {/* Contraseña */}
            <div>
              <label className="mb-2 block text-xs font-medium uppercase tracking-widest text-white/40">
                Contraseña
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-3 pr-11 text-sm text-white placeholder-white/20 outline-none transition focus:border-allianz-blue focus:ring-1 focus:ring-allianz-blue"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  tabIndex={-1}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/30 hover:text-white/60 transition"
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
                {error}
              </div>
            )}

            {/* Botón */}
            <button
              type="submit"
              disabled={loading}
              className="group flex w-full items-center justify-center gap-2 rounded-xl bg-allianz-blue py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-50 mt-2"
            >
              {loading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <>
                  Entrar
                  <ArrowRight size={16} className="transition-transform group-hover:translate-x-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
