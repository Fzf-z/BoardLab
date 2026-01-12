import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    electron([
      {
        // Main-Process entry
        entry: 'electron/main.ts',
        vite: {
          build: {
            rollupOptions: {
              // Externalize native modules and heavy deps
              external: [
                'serialport', 
                'sqlite3', 
                'better-sqlite3', 
                'puppeteer', 
                'bufferutil', 
                'utf-8-validate',
                'electron-store' // sometimes safer external
              ],
            },
          },
        },
      },
      {
        entry: 'electron/preload.ts',
        onstart(options) {
          options.reload()
        },
        vite: {
          build: {
            rollupOptions: {
              external: ['serialport', 'sqlite3', 'better-sqlite3', 'puppeteer', 'bufferutil', 'utf-8-validate']
            }
          }
        }
      },
      {
        // Compile the worker as a separate entry
        entry: 'electron/db-worker.ts',
        vite: {
          build: {
            rollupOptions: {
              external: ['better-sqlite3', 'path', 'fs']
            }
          }
        }
      }
    ]),
  ],
  base: './', 
  server: {
    port: 5173,
    strictPort: true,
  }
})