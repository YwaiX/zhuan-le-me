<template>
  <div class="json-format">
    <div class="json-format__toolbar">
      <el-button type="primary" @click="formatJson">
        <span>格式化</span>
      </el-button>
      <el-button @click="compressJson">
        <span>压缩</span>
      </el-button>
      <el-button :disabled="!output" @click="copyOutput">
        <span>复制结果</span>
      </el-button>
      <el-button @click="clearAll">
        <span>清空</span>
      </el-button>
      <el-checkbox v-model="preserveEscapes" class="json-format__checkbox">
        保留转义字符
      </el-checkbox>
    </div>
    <div class="json-format__panels">
      <div class="json-format__panel">
        <div class="json-format__panel-header">输入</div>
        <div class="json-format__editor">
          <div class="json-format__gutter" ref="inputGutterRef">{{ inputLines }}</div>
          <textarea
            v-model="input"
            ref="inputAreaRef"
            class="json-format__textarea"
            placeholder="在此粘贴 JSON..."
            spellcheck="false"
            wrap="off"
            @scroll="onGutterScroll($event, inputGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
      <div class="json-format__panel">
        <div class="json-format__panel-header">输出</div>
        <div class="json-format__editor">
          <div class="json-format__gutter" ref="outputGutterRef">{{ outputLines }}</div>
          <textarea
            v-model="output"
            ref="outputAreaRef"
            class="json-format__textarea"
            placeholder="格式化结果将显示在这里"
            spellcheck="false"
            wrap="off"
            readonly
            @scroll="onGutterScroll($event, outputGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
    </div>
    <FileStatusBar>
      <template v-if="error">
        <span class="json-format__inline">
          <b class="json-format__error">✕ JSON 异常</b>
          <span class="json-format__sep">|</span>
          {{ error }}
        </span>
      </template>
      <template v-else-if="output">
        <span class="json-format__inline">
          <b class="json-format__ok">✓ JSON 有效</b>
          <span class="json-format__sep">|</span>
          {{ outputSize }}
        </span>
      </template>
      <template v-else>
        <span class="json-format__muted">等待输入...</span>
      </template>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

const input = ref('')
const output = ref('')
const error = ref('')
const preserveEscapes = ref(false)

const inputAreaRef = ref(null)
const outputAreaRef = ref(null)
const inputGutterRef = ref(null)
const outputGutterRef = ref(null)

const outputSize = computed(() => {
  if (!output.value) return ''
  const bytes = new TextEncoder().encode(output.value).length
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})

const inputLines = computed(() => {
  const count = (input.value || '').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

const outputLines = computed(() => {
  const count = (output.value || ' ').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

function onGutterScroll(event, gutterEl) {
  if (gutterEl) {
    gutterEl.scrollTop = event.target.scrollTop
  }
}

function parseInput() {
  error.value = ''
  try {
    let value = JSON.parse(input.value)
    // 处理多重序列化：输入本身是 JSON 字符串，其内容仍可解析时逐层展开到对象/数组
    while (typeof value === 'string') {
      let inner
      try {
        inner = JSON.parse(value)
      } catch {
        break
      }
      // 仅当内层仍是字符串或对象/数组时继续，避免把 "123" 等标量字符串误转成数字
      if (typeof inner === 'string' || (inner !== null && typeof inner === 'object')) {
        value = inner
      } else {
        break
      }
    }
    return value
  } catch (e) {
    error.value = e.message
    return null
  }
}

function stringifyValue(value, space, indent = 0) {
  const pad = space ? space.repeat(indent) : ''
  const innerPad = space ? space.repeat(indent + 1) : ''
  const sep = space ? ' ' : ''

  if (value === null) return 'null'
  if (typeof value === 'boolean' || typeof value === 'number') return String(value)

  if (typeof value === 'string') {
    const escaped = value.replace(/[\b\f\n\r\t\\"]/g, (c) => {
      const map = { '\b': '\\b', '\f': '\\f', '\n': '\\n', '\r': '\\r', '\t': '\\t', '\\': '\\\\', '"': '\\"' }
      return map[c]
    })
    return `"${escaped}"`
  }

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]'
    const items = value.map((v) => stringifyValue(v, space, indent + 1))
    if (space) {
      return `[\n${innerPad}${items.join(`,\n${innerPad}`)}\n${pad}]`
    }
    return `[${items.join(`,${sep}`)}]`
  }

  if (typeof value === 'object') {
    const keys = Object.keys(value)
    if (keys.length === 0) return '{}'
    const items = keys.map((k) => {
      const v = stringifyValue(value[k], space, indent + 1)
      return `"${k}":${sep}${v}`
    })
    if (space) {
      return `{\n${innerPad}${items.join(`,\n${innerPad}`)}\n${pad}}`
    }
    return `{${items.join(`,${sep}`)}}`
  }

  return String(value)
}

function myStringify(value, space) {
  return stringifyValue(value, space)
}

function formatJson() {
  const parsed = parseInput()
  if (parsed === null) return
  if (preserveEscapes.value) {
    output.value = myStringify(parsed, '  ')
  } else {
    output.value = JSON.stringify(parsed, null, 2)
  }
}

function compressJson() {
  const parsed = parseInput()
  if (parsed === null) return
  if (preserveEscapes.value) {
    output.value = myStringify(parsed, '')
  } else {
    output.value = JSON.stringify(parsed)
  }
}

async function copyOutput() {
  if (!output.value) return
  try {
    await navigator.clipboard.writeText(output.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

function clearAll() {
  input.value = ''
  output.value = ''
  error.value = ''
}
</script>

<style scoped>
.json-format {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.json-format__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.json-format__checkbox {
  margin-left: auto;
  height: 32px;
}

.json-format__panels {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.json-format__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.json-format__panel-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.json-format__editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.json-format__editor:focus-within {
  border-color: #409eff;
}

.json-format__gutter {
  flex-shrink: 0;
  padding: 8px;
  overflow: hidden;
  text-align: right;
  color: #999;
  background: #f5f7fa;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  user-select: none;
}

.json-format__textarea {
  flex: 1;
  min-width: 0;
  padding: 8px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  background: #fff;
  overflow: auto;
  white-space: pre;
  overflow-wrap: normal;
}

.json-format__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}

.json-format__inline {
  display: flex;
  align-items: center;
}

.json-format__muted {
  color: #999;
}

.json-format__sep {
  color: #ddd;
  margin: 0 8px;
}

.json-format__ok {
  color: #67c23a;
}

.json-format__error {
  color: #f56c6c;
}
</style>
