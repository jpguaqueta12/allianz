import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../back-planificacion', '')
  const frontendPort = Number(env.FRONTEND_PORT) || 5174
  const apiProxyTarget = env.VITE_API_PROXY_TARGET

  const isDev = mode === 'development'

  return {
    plugins: [react()],
    server: isDev ? {
      port: frontendPort,
      ...(apiProxyTarget && {
        proxy: { '/api': apiProxyTarget },
      }),
    } : {},
  }
})
