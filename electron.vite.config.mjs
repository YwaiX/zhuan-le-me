import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [vue(), wasm(), topLevelAwait()],
    build: {
      target: 'esnext'
    },
    optimizeDeps: {
      exclude: ['prettier', 'prettier-plugin-java']
    }
  }
})
