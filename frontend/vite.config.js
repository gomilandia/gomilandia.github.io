import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  server: { host: '127.0.0.1', port: 4317 },
  preview: { host: '127.0.0.1', port: 4318 },
  plugins: [
    react(),
    tailwindcss(),
  ],
})
