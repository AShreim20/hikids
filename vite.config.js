import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const __dirname = path.dirname(fileURLToPath(import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
  ],
  resolve: {
    alias: {
      // Was previously provided by @base44/vite-plugin; kept explicit here
      // now that the Base44 SDK/tooling is gone (see jsconfig.json's
      // matching "@/*" path, which drives editor/TS resolution only).
      '@': path.resolve(__dirname, './src'),
    },
  },
});
