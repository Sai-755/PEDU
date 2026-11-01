import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig(({ mode }) => {
  if (mode === 'production') {
    const env = loadEnv(mode, process.cwd(), 'VITE_');
    let apiUrl;
    try { apiUrl = new URL(env.VITE_API_URL || ''); } catch { apiUrl = null; }
    if (!apiUrl || apiUrl.protocol !== 'https:' || !apiUrl.pathname.replace(/\/+$/, '').endsWith('/api') || /localhost|127\.0\.0\.1|yourdomain\.com|example\.com/i.test(apiUrl.hostname)) {
      throw new Error('Set VITE_API_URL to your real public HTTPS API URL ending in /api in client/.env.production before building for deployment.');
    }
  }
  return {
    plugins: [react(), tailwindcss()],
    server: { port: 5173 }
  };
});
