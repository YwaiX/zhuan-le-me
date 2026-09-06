<template>
  <div class="md5">
    <div class="md5__toolbar">
      <div class="md5__options">
        <span class="md5__label">位数</span>
        <el-radio-group v-model="bits" size="small">
          <el-radio-button :value="32">32位</el-radio-button>
          <el-radio-button :value="16">16位</el-radio-button>
        </el-radio-group>
        <span class="md5__label">大小写</span>
        <el-radio-group v-model="letterCase" size="small">
          <el-radio-button value="lower">小写</el-radio-button>
          <el-radio-button value="upper">大写</el-radio-button>
        </el-radio-group>
      </div>
      <el-button :disabled="!hash" @click="copyHash">
        <span>复制结果</span>
      </el-button>
      <el-button @click="clearAll">
        <span>清空</span>
      </el-button>
    </div>
    <div class="md5__body">
      <div class="md5__panel">
        <div class="md5__panel-header">输入</div>
        <div class="md5__editor">
          <div class="md5__gutter" ref="inputGutterRef">{{ inputLines }}</div>
          <textarea
            v-model="input"
            class="md5__textarea"
            placeholder="在此输入文本..."
            spellcheck="false"
            wrap="off"
            @scroll="onGutterScroll($event, inputGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
      <div class="md5__panel">
        <div class="md5__panel-header">MD5 哈希</div>
        <div class="md5__editor md5__editor--output">
          <div class="md5__hash">{{ hash }}</div>
        </div>
      </div>
    </div>
    <FileStatusBar>
      <template v-if="hash">
        <span class="md5__inline">
          <b class="md5__ok">MD5</b>
          <span class="md5__sep">|</span>
          {{ bits }}位 · {{ letterCase === 'lower' ? '小写' : '大写' }}
        </span>
      </template>
      <template v-else>
        <span class="md5__muted">输入文本自动生成 MD5</span>
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
const bits = ref(32)
const letterCase = ref('lower')

const inputGutterRef = ref(null)

function onGutterScroll(event, gutterEl) {
  if (gutterEl) gutterEl.scrollTop = event.target.scrollTop
}

const inputLines = computed(() => {
  const count = (input.value || '').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

/* ===== MD5 实现 ===== */
function md5(text) {
  function rotateLeft(n, s) { return (n << s) | (n >>> (32 - s)) }

  function toHex(val) {
    let hex = ''
    for (let i = 0; i < 4; i++) {
      hex += ((val >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    }
    return hex
  }

  const bytes = []
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i)
    if (code < 0x80) {
      bytes.push(code)
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >>> 6), 0x80 | (code & 0x3f))
    } else if (code < 0xd800 || code >= 0xe000) {
      bytes.push(0xe0 | (code >>> 12), 0x80 | ((code >>> 6) & 0x3f), 0x80 | (code & 0x3f))
    } else {
      const cp = 0x10000 + ((code & 0x3ff) << 10) + (text.charCodeAt(++i) & 0x3ff)
      bytes.push(
        0xf0 | (cp >>> 18),
        0x80 | ((cp >>> 12) & 0x3f),
        0x80 | ((cp >>> 6) & 0x3f),
        0x80 | (cp & 0x3f)
      )
    }
  }

  const bitLen = bytes.length * 8
  bytes.push(0x80)
  while (bytes.length % 64 !== 56) bytes.push(0)

  for (let i = 0; i < 4; i++) {
    bytes.push((bitLen >>> (i * 8)) & 0xff)
  }
  bytes.push(0, 0, 0, 0)

  const words = []
  for (let i = 0; i < bytes.length; i += 4) {
    words.push(bytes[i] | (bytes[i + 1] << 8) | (bytes[i + 2] << 16) | (bytes[i + 3] << 24))
  }

  let a = 0x67452301, b = 0xefcdab89, c = 0x98badcfe, d = 0x10325476

  const S = [
    [7, 12, 17, 22], [5, 9, 14, 20], [4, 11, 16, 23], [6, 10, 15, 21]
  ]
  const K = []
  for (let i = 0; i < 64; i++) {
    K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 0x100000000)
  }

  for (let bi = 0; bi < words.length; bi += 16) {
    let aa = a, bb = b, cc = c, dd = d

    for (let i = 0; i < 64; i++) {
      let f, g
      if (i < 16) {
        f = (b & c) | (~b & d)
        g = i
      } else if (i < 32) {
        f = (d & b) | (~d & c)
        g = (5 * i + 1) % 16
      } else if (i < 48) {
        f = b ^ c ^ d
        g = (3 * i + 5) % 16
      } else {
        f = c ^ (b | ~d)
        g = (7 * i) % 16
      }
      f = (f + a + K[i] + words[bi + g]) | 0
      a = d
      d = c
      c = b
      b = (b + rotateLeft(f, S[Math.floor(i / 16)][i % 4])) | 0
    }
    a = (a + aa) | 0
    b = (b + bb) | 0
    c = (c + cc) | 0
    d = (d + dd) | 0
  }

  return [a, b, c, d]
}

function md5Hex(input) {
  const arr = md5(input)
  return arr.map((v) => {
    let hex = ''
    for (let i = 0; i < 4; i++) {
      hex += ((v >>> (i * 8)) & 0xff).toString(16).padStart(2, '0')
    }
    return hex
  }).join('')
}

const hash = computed(() => {
  if (!input.value) return ''
  const result = md5Hex(input.value)
  const hex32 = result
  const hex16 = result.substring(8, 24)
  const out = bits.value === 16 ? hex16 : hex32
  return letterCase.value === 'upper' ? out.toUpperCase() : out
})


async function copyHash() {
  if (!hash.value) return
  try {
    await navigator.clipboard.writeText(hash.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

function clearAll() {
  input.value = ''
}
</script>

<style scoped>
.md5 {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.md5__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.md5__options {
  display: flex;
  align-items: center;
  gap: 8px;
}

.md5__label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-left: 4px;
}

.md5__body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.md5__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.md5__panel-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.md5__editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.md5__editor:focus-within {
  border-color: #409eff;
}

.md5__editor--output {
  align-items: center;
  justify-content: center;
}

.md5__gutter {
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

.md5__textarea {
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

.md5__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}

.md5__hash {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 16px;
  color: #333;
  word-break: break-all;
  padding: 16px;
  text-align: center;
}

.md5__inline {
  display: flex;
  align-items: center;
}

.md5__muted {
  color: #999;
}

.md5__sep {
  color: #ddd;
  margin: 0 8px;
}

.md5__ok {
  color: #67c23a;
}
</style>
