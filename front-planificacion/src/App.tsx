import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, NavLink } from 'react-router-dom'
import { MessageSquare, LayoutDashboard, Loader2, Settings2, ShieldCheck, Calculator, Factory, AlertCircle, Upload, FileUp } from 'lucide-react'
import { DashboardPage } from './pages/DashboardPage'
import { ChatPage } from './pages/ChatPage'
import { ConfigPage } from './pages/ConfigPage'
import { EstimationPage } from './pages/EstimationPage'
import { FabricaPage } from './pages/FabricaPage'
import { IncidentesPage } from './pages/IncidentesPage'
import { UploadPage } from './pages/UploadPage'
import { UploadIncidentesPage } from './pages/UploadIncidentesPage'
import { useChatStore } from './stores/chatStore'
import { createSession } from './services/api'
import clsx from 'clsx'

const navItems = [
  { to: '/', label: 'Módulo de Mejora Continua', icon: LayoutDashboard, end: true },
  { to: '/fabrica', label: 'Módulo de Fábrica', icon: Factory },
  { to: '/incidentes', label: 'Módulo de Incidentes', icon: AlertCircle },
  { to: '/upload', label: 'Subir Info MD/FA', icon: Upload },
  { to: '/upload-incidentes', label: 'Subir Incidentes', icon: FileUp },
  { to: '/chat', label: 'Agente IA', icon: MessageSquare },
  { to: '/estimacion', label: 'Estimación', icon: Calculator },
  { to: '/config', label: 'Configuración PI', icon: Settings2 },
]

function Layout() {
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
        </nav>

        <div className="border-t border-corporate-line p-4">
          <div className="rounded-md border border-green-100 bg-green-50 px-3 py-2">
            <div className="flex items-center gap-2 text-xs font-medium text-green-800">
              <ShieldCheck size={14} />
              Sistema operativo
            </div>
            <p className="mt-1 text-[11px] text-green-700">Planificador Allianz operativo</p>
          </div>
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
          <Route path="/config" element={<ConfigPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default function App() {
  const { setSessionId } = useChatStore()
  const [ready, setReady] = useState(false)

  useEffect(() => {
    createSession()
      .then((r) => {
        setSessionId(r.session_id)
        setReady(true)
      })
      .catch(() => setReady(true))
  }, [setSessionId])

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
      <Layout />
    </BrowserRouter>
  )
}
