import './assets/main.css'

import ElementPlus from 'element-plus'
import 'element-plus/dist/index.css'
import { createApp } from 'vue'
import App from './App.vue'
import route from './router'

const app = createApp(App)

app.use(ElementPlus)
app.use(route)
app.mount('#app')
