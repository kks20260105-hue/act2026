import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig(({ mode }) => {

  const isDev = mode === 'development';

  return {
    plugins: [react()],

    resolve: {
      alias: {
        '@': path.resolve(__dirname, './src'),
      },
    },

    server: {
      port: 3000,
      strictPort: true,   // 3000 포트 점유 시 자동 증가 방지
      host: '0.0.0.0',   // IPv4 + IPv6 모두 바인딩

      // 개발환경에서만 프록시 사용
      proxy: isDev
        ? {
            '/api': {
              target: 'http://localhost:4000',
              changeOrigin: true,
            },
          }
        : undefined,
    },

    build: {
      outDir: 'dist',
      sourcemap: false,
    },
  };
});