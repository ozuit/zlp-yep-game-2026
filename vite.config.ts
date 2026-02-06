import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  base: '/zlp-yep-game-2026/', // GitHub Pages: https://<username>.github.io/zlp-yep-game-2026/
  plugins: [react()],
})
