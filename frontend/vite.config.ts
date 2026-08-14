import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  // リポジトリ直下の.envを読み込む(バックエンドと共通の.envを利用するため)
  envDir: '..',
  plugins: [
    react(),
    tailwindcss(),
  ],
})
