import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate } from 'react-router-dom'
import { MessageSquare, LayoutDashboard, Loader2, Settings2, ShieldCheck, Calculator, Factory, AlertCircle, Upload, FileUp, LogOut, KeyRound } from 'lucide-react'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { ConfigPage } from './pages/ConfigPage'
import { EstimationPage } from './pages/EstimationPage'
import { FabricaPage } from './pages/FabricaPage'
import { IncidentesPage } from './pages/IncidentesPage'
import { UploadPage } from './pages/UploadPage'
import { UploadIncidentesPage } from './pages/UploadIncidentesPage'
import { LoginPage } from './pages/LoginPage'
import { useChatStore } from './stores/chatStore'
import { useAuthStore } from './stores/authStore'
import { createSession, verifyToken } from './services/api'
import clsx from 'clsx'

const navItems = [
  { to: '/', label: 'Módulo de Mejora Continua', icon: LayoutDashboard, end: true },
  { to: '/fabrica', label: 'Módulo de Fábrica', icon: Factory },
  { to: '/incidentes', label: 'Módulo de Incidentes', icon: AlertCircle },
  { to: '/upload', label: 'Subir Info MD/FA', icon: Upload },
  { to: '/upload-incidentes', label: 'Subir Incidentes', icon: FileUp },
  { to: '/chat', label: 'Agente IA', icon: MessageSquare },
  { to: '/estimacion', label: 'Estimación', icon: Calculator },
]

// Ruta protegida: cualquier usuario autenticado
function ProtectedRoute({ children, superuserOnly = false }: { children: React.ReactNode; superuserOnly?: boolean }) {
  const { isAuthenticated, isSuperUser } = useAuthStore()
  if (!isAuthenticated) return <Navigate to="/login" replace />
  if (superuserOnly && !isSuperUser) return <Navigate to="/" replace />
  return <>{children}</>
}

function Layout() {
  const { isSuperUser, logout } = useAuthStore()
  const navigate = useNavigate()

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="flex h-screen bg-corporate-surface text-corporate-ink">
      <aside className="flex w-[248px] flex-shrink-0 flex-col border-r border-corporate-line bg-white">
        <div className="border-b border-corporate-line px-5 py-5">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-allianz-blue text-sm font-semibold text-white">
              ND
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-corporate-ink">NTT DATA</p>
              <p className="text-xs text-corporate-muted">Planificador para Allianz</p>
            </div>
          </div>
        </div>

        <nav className="flex flex-1 flex-col gap-1 px-3 py-4">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-allianz-blue'
                    : 'text-corporate-muted hover:bg-corporate-surface hover:text-corporate-ink',
                )
              }
            >
              <item.icon size={18} />
              <span>{item.label}</span>
            </NavLink>
          ))}

          {/* Configuración PI — solo visible para superusuario */}
          {isSuperUser && (
            <NavLink
              to="/config"
              className={({ isActive }) =>
                clsx(
                  'flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors',
                  isActive
                    ? 'bg-blue-50 text-allianz-blue'
                    : 'text-corporate-muted hover:bg-corporate-surface hover:text-corporate-ink',
                )
              }
            >
              <Settings2 size={18} />
              <span>Configuración PI</span>
            </NavLink>
          )}
        </nav>

        <div className="border-t border-corporate-line p-4 flex flex-col gap-2">
          {isSuperUser ? (
            <div className="rounded-md border border-blue-100 bg-blue-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium text-allianz-blue">
                <KeyRound size={14} />
                Superusuario activo
              </div>
              <p className="mt-0.5 text-[11px] text-blue-600">Acceso total habilitado</p>
            </div>
          ) : (
            <div className="rounded-md border border-green-100 bg-green-50 px-3 py-2">
              <div className="flex items-center gap-2 text-xs font-medium text-green-800">
                <ShieldCheck size={14} />
                Sistema operativo
              </div>
              <p className="mt-1 text-[11px] text-green-700">Planificador Allianz operativo</p>
            </div>
          )}
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium text-corporate-muted hover:bg-corporate-surface hover:text-red-600 transition-colors"
          >
            <LogOut size={14} />
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/fabrica" element={<FabricaPage />} />
          <Route path="/incidentes" element={<IncidentesPage />} />
          <Route path="/upload" element={<UploadPage />} />
          <Route path="/upload-incidentes" element={<UploadIncidentesPage />} />
          <Route path="/chat" element={<ChatPage />} />
          <Route path="/estimacion" element={<EstimationPage />} />
          <Route
            path="/config"
            element={
              <ProtectedRoute superuserOnly>
                <ConfigPage />
              </ProtectedRoute>
            }
          />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { setSessionId } = useChatStore()
  const { isAuthenticated, token, logout, login } = useAuthStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const init = async () => {
      // Si hay sesión guardada en localStorage, verificar que el token sigue vigente
      if (isAuthenticated && token) {
        const { valid, role } = await verifyToken()
        if (!valid) {
          logout()
        } else if (role) {
          login(token, role)
        }
      }
      // Crear sesión de chat
      try {
        const r = await createSession()
        setSessionId(r.session_id)
      } catch {
        // ignorar — la app puede funcionar sin sesión de chat
      }
      setReady(true)
    }
    init()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  if (!ready) {
    return (
      <div className="flex h-screen items-center justify-center bg-corporate-navy">
        <div className="flex flex-col items-center gap-3 text-white">
          <Loader2 size={32} className="animate-spin" />
          <p className="text-sm opacity-75">Iniciando agente planificador</p>
        </div>
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <Layout />
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
