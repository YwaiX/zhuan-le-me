import { resolve } from 'path'
import { defineConfig } from 'electron-vite'
import vue from '@vitejs/plugin-vue'
import wasm from 'vite-plugin-wasm'
import topLevelAwait from 'vite-plugin-top-level-await'
import AutoImport from 'unplugin-auto-import/vite'
import Components from 'unplugin-vue-components/vite'
import { ElementPlusResolver } from 'unplugin-vue-components/resolvers'

export default defineConfig({
  main: {},
  preload: {},
  renderer: {
    define: {
      // 启动打点开关：PERF_DEBUG=1 构建时注入，供渲染进程读取
      __PERF_DEBUG__: JSON.stringify(process.env.PERF_DEBUG === '1')
    },
    resolve: {
      alias: {
        '@renderer': resolve('src/renderer/src')
      }
    },
    plugins: [
      vue(),
      wasm(),
      topLevelAwait(),
      // Element Plus 自动按需引入：组件由 Components 注册，ElMessage 等 API 由 AutoImport 注入
      AutoImport({
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: false
      }),
      Components({
        resolvers: [ElementPlusResolver({ importStyle: 'css' })],
        dts: false
      })
    ],
    build: {
      target: 'esnext'
    },
    optimizeDeps: {
      exclude: ['prettier', 'prettier-plugin-java']
    }
  }
})
