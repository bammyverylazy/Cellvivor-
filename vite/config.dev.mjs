import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
    base: './',
    plugins: [
        react(),
    ],
    server: {
  port: 8080,
  proxy: {
    '/api':{  
        target: 'https://cellvivor-backend.onrender.com',
        changeOrigin: true,
        secure: true,},
  }
}
})
