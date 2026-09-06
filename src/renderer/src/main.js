import './assets/main.css'

import { createApp } from 'vue'
import App from './App.vue'
import route from './router'

// 启动性能打点：由 vite define 注入（PERF_DEBUG=1 构建时开启），统计相对脚本求值完成的耗时
const PERF_DEBUG = __PERF_DEBUG__
const perfT0 = performance.now()
function perfLog(label) {
  if (PERF_DEBUG) console.log(`[perf][renderer] ${label}: ${Math.round(performance.now() - perfT0)}ms`)
}
perfLog('script-body-start')

const app = createApp(App)

app.use(route)
perfLog('plugins-installed')
app.mount('#app')
perfLog('app-mounted')
requestAnimationFrame(() => perfLog('first-frame'))
