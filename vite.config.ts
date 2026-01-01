import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
    // Memuat semua variabel dari file .env
    const env = loadEnv(mode, '.', '');
    
    return {
      server: {
        port: 3000,
        host: '0.0.0.0',
      },
      plugins: [react()],
      define: {
        // --- BAGIAN YANG DIUBAH ---
        // Kita perintahkan Vite untuk mengambil 'GEMINI_API_KEYS' (jamak)
        // dan memasukkannya ke dalam 'process.env.GEMINI_API_KEYS' di aplikasi.
        'process.env.GEMINI_API_KEYS': JSON.stringify(env.GEMINI_API_KEYS),
        // --------------------------
      },
      resolve: {
        alias: {
          '@': path.resolve(__dirname, '.'),
        }
      }
    };
});
