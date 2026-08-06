<template>
  <div class="base64">
    <div class="base64__toolbar">
      <el-button type="primary" @click="encode">
        <span>Base64 编码</span>
      </el-button>
      <el-button @click="decode">
        <span>Base64 解码</span>
      </el-button>
      <el-button :disabled="!output" @click="copyOutput">
        <span>复制结果</span>
      </el-button>
      <el-button @click="clearAll">
        <span>清空</span>
      </el-button>
    </div>
    <div class="base64__panels">
      <div class="base64__panel">
        <div class="base64__panel-header">输入</div>
        <div class="base64__editor">
          <div class="base64__gutter" ref="inputGutterRef">{{ inputLines }}</div>
          <textarea
            v-model="input"
            class="base64__textarea"
            placeholder="在此粘贴文本..."
            spellcheck="false"
            wrap="off"
            @scroll="onGutterScroll($event, inputGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
      <div class="base64__panel">
        <div class="base64__panel-header">输出</div>
        <div class="base64__editor">
          <div class="base64__gutter" ref="outputGutterRef">{{ outputLines }}</div>
          <textarea
            v-model="output"
            class="base64__textarea"
            placeholder="结果将显示在这里"
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
        <span class="base64__inline">
          <b class="base64__error">✕ {{ error }}</b>
        </span>
      </template>
      <template v-else-if="output">
        <span class="base64__inline">
          <b class="base64__ok">✓ 操作成功</b>
          <span class="base64__sep">|</span>
          {{ outputSize }}
        </span>
      </template>
      <template v-else>
        <span class="base64__muted">输入文本后点击编码或解码</span>
      </template>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import { ElMessage } from 'element-plus'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

const input = ref('')
const output = ref('')
const error = ref('')

const inputGutterRef = ref(null)
const outputGutterRef = ref(null)

function onGutterScroll(event, gutterEl) {
  if (gutterEl) {
    gutterEl.scrollTop = event.target.scrollTop
  }
}

const inputLines = computed(() => {
  const count = (input.value || '').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

const outputLines = computed(() => {
  const count = (output.value || ' ').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

const outputSize = computed(() => {
  if (!output.value) return ''
  const bytes = new TextEncoder().encode(output.value).length
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})

function encode() {
  error.value = ''
  try {
    output.value = btoa(unescape(encodeURIComponent(input.value)))
  } catch (e) {
    error.value = '编码失败: ' + e.message
  }
}

function decode() {
  error.value = ''
  try {
    output.value = decodeURIComponent(escape(atob(input.value.trim())))
  } catch (e) {
    error.value = '解码失败: 输入不是有效的 Base64 字符串'
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
.base64 {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.base64__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.base64__panels {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.base64__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.base64__panel-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.base64__editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.base64__editor:focus-within {
  border-color: #409eff;
}

.base64__gutter {
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

.base64__textarea {
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

.base64__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}

.base64__inline {
  display: flex;
  align-items: center;
}

.base64__muted {
  color: #999;
}

.base64__sep {
  color: #ddd;
  margin: 0 8px;
}

.base64__ok {
  color: #67c23a;
}

.base64__error {
  color: #f56c6c;
}
</style>
