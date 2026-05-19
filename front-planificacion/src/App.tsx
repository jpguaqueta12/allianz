import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, NavLink, Navigate, useNavigate } from 'react-router-dom'
import { MessageSquare, LayoutDashboard, Settings2, ShieldCheck, Calculator, Factory, AlertCircle, Upload, FileUp, LogOut, KeyRound } from 'lucide-react'
import { LoginPage } from './pages/LoginPage'
import { useAuthStore } from './stores/authStore'
import { verifyToken } from './services/api'
import clsx from 'clsx'

const DashboardPage = lazy(() => import('./pages/DashboardPage').then((m) => ({ default: m.DashboardPage })))
const ChatPage = lazy(() => import('./pages/ChatPage').then((m) => ({ default: m.ChatPage })))
const ConfigPage = lazy(() => import('./pages/ConfigPage').then((m) => ({ default: m.ConfigPage })))
const EstimationPage = lazy(() => import('./pages/EstimationPage').then((m) => ({ default: m.EstimationPage })))
const FabricaPage = lazy(() => import('./pages/FabricaPage').then((m) => ({ default: m.FabricaPage })))
const IncidentesPage = lazy(() => import('./pages/IncidentesPage').then((m) => ({ default: m.IncidentesPage })))
const UploadPage = lazy(() => import('./pages/UploadPage').then((m) => ({ default: m.UploadPage })))
const UploadIncidentesPage = lazy(() => import('./pages/UploadIncidentesPage').then((m) => ({ default: m.UploadIncidentesPage })))

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
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />
  }
  if (superuserOnly && !isSuperUser) return <Navigate to="/" replace />
  return <>{children}</>
}

function PageLoader() {
  return (
    <div className="flex h-full items-center justify-center bg-corporate-surface">
      <div className="text-sm font-medium text-corporate-muted">Cargando módulo...</div>
    </div>
  )
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
        <Suspense fallback={<PageLoader />}>
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
        </Suspense>
      </main>
    </div>
  )
}

export default function App() {
  const { isAuthenticated, token, logout, setRole } = useAuthStore()

  useEffect(() => {
    if (!isAuthenticated || !token) return
    verifyToken().then(({ valid, role }) => {
      if (!valid) logout()
      else if (role) setRole(role)
    }).catch(() => {
      logout()
    })
  }, [isAuthenticated, logout, setRole, token])

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
