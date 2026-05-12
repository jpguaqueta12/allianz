import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../back-planificacion', '')
  const frontendPort = Number(env.FRONTEND_PORT)
  const apiProxyTarget = env.VITE_API_PROXY_TARGET

  if (!frontendPort) {
    throw new Error('FRONTEND_PORT debe estar definido en back-planificacion/.env')
  }
  if (!apiProxyTarget) {
    throw new Error('VITE_API_PROXY_TARGET debe estar definido en back-planificacion/.env')
  }

  return {
    plugins: [react()],
    server: {
      port: frontendPort,
      proxy: {
        '/api': apiProxyTarget,
      },
    },
  }
})
