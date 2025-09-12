// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // --- INICIO DE LA CORRECCIÓN ---
  server: {
    hmr: {
      clientPort: 443,
    }
  }
  // --- FIN DE LA CORRECCIÓN ---
})