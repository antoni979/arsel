// vite.config.js
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vite.dev/config/
export default defineConfig({
  plugins: [vue()],
  // --- INICIO DEL CAMBIO ---
  server: {
    hmr: {
      // Esto fuerza al cliente de HMR a conectarse a través del puerto 443 (HTTPS estándar),
      // que es el que el proxy de Codespaces utiliza para todo el tráfico público.
      // El proxy se encargará de redirigirlo internamente al puerto 5173 de Vite.
      clientPort: 443,
    }
  }
  // --- FIN DEL CAMBIO ---
})