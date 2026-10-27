import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  // 배포 서버(Netlify)에는 .env가 없으므로 기본값을 둠
  const base = new URL(
    env.VITE_BASE_URL || 'https://apis.data.go.kr/B551177/passgrAnncmt',
  )

  return {
    plugins: [react()],
    server: {
      // 개발 중 CORS 회피: /api/* → https://apis.data.go.kr/B551177/passgrAnncmt/*
      proxy: {
        '/api': {
          target: base.origin,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api/, base.pathname),
        },
      },
    },
  }
})
