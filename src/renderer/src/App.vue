<template>
  <div class="app-layout">
    <!-- 顶部标题栏 -->
    <header class="title-bar" @mousedown="onTitleBarMouseDown" @dblclick="onTitleBarDblClick">
      <!-- 左侧：应用图标 -->
      <div class="title-bar__left">
        <img class="title-bar__icon" src="./assets/electron.svg" alt="icon" />
      </div>

      <!-- 中间：搜索框 -->
      <div class="title-bar__center">
        <el-input
          v-model="searchText"
          class="title-bar__search"
          placeholder="搜索工具..."
          size="default"
          clearable>
          <template #prefix>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#999"
              stroke-width="2">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
          </template>
        </el-input>
      </div>

      <!-- 右侧：窗口控制按钮 -->
      <div class="title-bar__right">
        <button class="win-btn win-btn--minimize" title="最小化" @click.stop="handleMinimize">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <rect y="5" width="12" height="1.5" fill="currentColor" />
          </svg>
        </button>
        <button class="win-btn win-btn--maximize" title="最大化" @click.stop="handleMaximize">
          <svg v-if="isMaximized" width="12" height="12" viewBox="0 0 12 12">
            <rect
              x="2"
              y="0"
              width="10"
              height="10"
              rx="1"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2" />
            <rect
              x="0"
              y="2"
              width="10"
              height="10"
              rx="1"
              fill="var(--bg-titlebar)"
              stroke="currentColor"
              stroke-width="1.2" />
          </svg>
          <svg v-else width="12" height="12" viewBox="0 0 12 12">
            <rect
              x="0.5"
              y="0.5"
              width="11"
              height="11"
              rx="1.5"
              fill="none"
              stroke="currentColor"
              stroke-width="1.2" />
          </svg>
        </button>
        <button class="win-btn win-btn--close" title="关闭" @click.stop="handleClose">
          <svg width="12" height="12" viewBox="0 0 12 12">
            <path d="M1 1l10 10M11 1L1 11" stroke="currentColor" stroke-width="1.3" />
          </svg>
        </button>
      </div>
    </header>

    <div class="main-body">
      <!-- 左侧菜单栏 -->
      <aside class="sidebar">
        <div class="sidebar__title">工具列表</div>
        <el-menu
          :default-active="activeMenu"
          router
          :collapse="false"
          background-color="transparent"
          text-color="#333333"
          active-text-color="#409eff">
          <el-menu-item v-show="visibleMenuItems.has('/')" index="/">
            <span>首页</span>
          </el-menu-item>
          <el-sub-menu v-show="isSubMenuVisible" index="/convert">
            <template #title>转换工具</template>
            <el-menu-item v-show="visibleMenuItems.has('/convert/office')" index="/convert/office">
              <span>文件转换</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/convert/image')" index="/convert/image">
              <span>图片转换</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/convert/pdf')" index="/convert/pdf">
              <span>PDF转换</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-show="isSubMenuVisible" index="/json">
            <template #title>JSON工具</template>
            <el-menu-item v-show="visibleMenuItems.has('/json/format')" index="/json/format">
              <span>JSON格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/json/diff')" index="/json/diff">
              <span>代码对比</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-show="isSubMenuVisible" index="/crypto">
            <template #title>加密工具</template>
            <el-menu-item v-show="visibleMenuItems.has('/crypto/base64')" index="/crypto/base64">
              <span>Base64加解密</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/crypto/md5')" index="/crypto/md5">
              <span>MD5加密</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/crypto/keypair')" index="/crypto/keypair">
              <span>公钥私钥生成</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/crypto/keygen')" index="/crypto/keygen">
              <span>密钥生成</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/crypto/jwt')" index="/crypto/jwt">
              <span>JWT工具</span>
            </el-menu-item>
          </el-sub-menu>
          <el-sub-menu v-show="isSubMenuVisible" index="/format">
            <template #title>格式化工具</template>
            <el-menu-item v-show="visibleMenuItems.has('/format/java')" index="/format/java">
              <span>Java格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/javascript')" index="/format/javascript">
              <span>JavaScript格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/typescript')" index="/format/typescript">
              <span>TypeScript格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/yaml')" index="/format/yaml">
              <span>YAML格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/properties')" index="/format/properties">
              <span>Properties格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/sql')" index="/format/sql">
              <span>SQL格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/xml')" index="/format/xml">
              <span>XML格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/dockerfile')" index="/format/dockerfile">
              <span>Dockerfile格式化</span>
            </el-menu-item>
            <el-menu-item v-show="visibleMenuItems.has('/format/nginx')" index="/format/nginx">
              <span>Nginx格式化</span>
            </el-menu-item>
          </el-sub-menu>
        </el-menu>
      </aside>

      <!-- 右侧内容区 -->
      <main class="content-area">
        <router-view />
      </main>
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { useRoute } from 'vue-router'

const route = useRoute()

// 搜索文本
const searchText = ref('')

// 窗口是否已最大化（控制按钮图标切换）
const isMaximized = ref(false)

// 当前激活的菜单项
const activeMenu = computed(() => route.path)

// 工具列表（扁平结构，用于搜索匹配）
const toolList = ref([
  { name: '首页', path: '/' },
  { name: '文件转换', path: '/convert/office', parent: '/convert' },
  { name: '图片转换', path: '/convert/image', parent: '/convert' },
  { name: 'PDF转换', path: '/convert/pdf', parent: '/convert' },
  { name: 'JSON格式化', path: '/json/format', parent: '/json' },
  { name: '代码对比', path: '/json/diff', parent: '/json' },
  { name: 'Base64加解密', path: '/crypto/base64', parent: '/crypto' },
  { name: 'MD5加密', path: '/crypto/md5', parent: '/crypto' },
  { name: '公钥私钥生成', path: '/crypto/keypair', parent: '/crypto' },
  { name: '密钥生成', path: '/crypto/keygen', parent: '/crypto' },
  { name: 'JWT工具', path: '/crypto/jwt', parent: '/crypto' },
  { name: 'Java格式化', path: '/format/java', parent: '/format' },
  { name: 'JavaScript格式化', path: '/format/javascript', parent: '/format' },
  { name: 'TypeScript格式化', path: '/format/typescript', parent: '/format' },
  { name: 'YAML格式化', path: '/format/yaml', parent: '/format' },
  { name: 'Properties格式化', path: '/format/properties', parent: '/format' },
  { name: 'SQL格式化', path: '/format/sql', parent: '/format' },
  { name: 'XML格式化', path: '/format/xml', parent: '/format' },
  { name: 'Dockerfile格式化', path: '/format/dockerfile', parent: '/format' },
  { name: 'Nginx格式化', path: '/format/nginx', parent: '/format' }
])

// 搜索过滤：返回可见菜单项的 path 集合
const visibleMenuItems = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return new Set(toolList.value.map((t) => t.path))
  return new Set(
    toolList.value.filter((t) => t.name.toLowerCase().includes(keyword)).map((t) => t.path)
  )
})

// 父级子菜单是否可见（有任一子项匹配搜索时显示）
const isSubMenuVisible = computed(() => {
  const keyword = searchText.value.trim().toLowerCase()
  if (!keyword) return true
  return toolList.value.some(
    (t) => t.parent && t.name.toLowerCase().includes(keyword)
  )
})

// ==================== 窗口控制按钮 ====================

function handleMinimize() {
  window.api.windowMinimize()
}

async function handleMaximize() {
  isMaximized.value = await window.api.windowToggleMaximize()
}

function handleClose() {
  window.api.windowClose()
}

// ==================== 窗口拖拽逻辑 ====================
// 通过 IPC 通信实现无边框窗口拖拽，不使用 -webkit-app-region: drag

let isDragging = false
let startScreenX = 0
let startScreenY = 0

function skipTarget(e) {
  return e.target.closest('.el-input') || e.target.closest('.el-input__wrapper')
}

// 双击标题栏 → 最大化/还原切换
async function onTitleBarDblClick(e) {
  if (skipTarget(e)) return
  isMaximized.value = await window.api.windowToggleMaximize()
}

// 标题栏鼠标按下 → 开始拖拽
function onTitleBarMouseDown(e) {
  if (skipTarget(e)) return

  isDragging = true
  startScreenX = e.screenX
  startScreenY = e.screenY

  document.addEventListener('mousemove', onMouseMove)
  document.addEventListener('mouseup', onMouseUp)
}

function onMouseMove(e) {
  if (!isDragging) return

  const deltaX = e.screenX - startScreenX
  const deltaY = e.screenY - startScreenY

  startScreenX = e.screenX
  startScreenY = e.screenY

  window.api.windowMove(deltaX, deltaY)
}

function onMouseUp() {
  stopDrag()
}

function stopDrag() {
  isDragging = false
  document.removeEventListener('mousemove', onMouseMove)
  document.removeEventListener('mouseup', onMouseUp)
}
</script>
