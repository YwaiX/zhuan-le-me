<template>
  <div class="keygen">
    <!-- 配置区域 -->
    <div class="keygen__toolbar">
      <el-button type="primary" :loading="generating" @click="generate">
        <span>生成密钥</span>
      </el-button>
      <el-select
        v-model="keyType"
        class="keygen__select keygen__select--type"
        placeholder="密钥类型"
        @change="onTypeChange">
        <el-option label="随机字符串" value="random-string" />
        <el-option label="UUID" value="uuid" />
        <el-option label="Base64 密钥" value="base64" />
        <el-option label="Hex 密钥" value="hex" />
        <el-option label="AES Key" value="aes" />
        <el-option label="HMAC Key" value="hmac" />
        <el-option label="Salt 盐值" value="salt" />
        <el-option label="Hash 随机值" value="hash" />
      </el-select>

      <!-- 随机字符串选项 -->
      <template v-if="keyType === 'random-string'">
        <el-input-number
          v-model="strLen"
          :min="4"
          :max="4096"
          class="keygen__num"
          controls-position="right" />
        <span class="keygen__unit">字符</span>
        <el-checkbox v-model="charset.digits" label="数字" />
        <el-checkbox v-model="charset.lowercase" label="小写" />
        <el-checkbox v-model="charset.uppercase" label="大写" />
        <el-checkbox v-model="charset.symbols" label="特殊" />
        <el-checkbox v-model="charset.removeAmbiguous" label="去混淆" />
      </template>

      <!-- UUID 无额外选项 -->

      <!-- Base64 选项 -->
      <template v-if="keyType === 'base64'">
        <el-select v-model="base64Bits" class="keygen__select--sm" placeholder="长度">
          <el-option label="128 bit" :value="128" />
          <el-option label="192 bit" :value="192" />
          <el-option label="256 bit" :value="256" />
          <el-option label="自定义 bit" :value="0" />
        </el-select>
        <el-input-number
          v-if="base64Bits === 0"
          v-model="base64Custom"
          :min="8"
          :max="4096"
          :step="8"
          class="keygen__num"
          controls-position="right" />
        <el-checkbox v-model="base64UrlSafe" label="URL Safe" />
      </template>

      <!-- Hex 选项 -->
      <template v-if="keyType === 'hex'">
        <el-select v-model="hexBits" class="keygen__select--sm" placeholder="长度">
          <el-option label="64 bit" :value="64" />
          <el-option label="128 bit" :value="128" />
          <el-option label="256 bit" :value="256" />
          <el-option label="512 bit" :value="512" />
          <el-option label="自定义 bit" :value="0" />
        </el-select>
        <el-input-number
          v-if="hexBits === 0"
          v-model="hexCustom"
          :min="8"
          :max="4096"
          :step="8"
          class="keygen__num"
          controls-position="right" />
      </template>

      <!-- AES 选项 -->
      <template v-if="keyType === 'aes'">
        <el-select v-model="aesBits" class="keygen__select--sm" placeholder="长度">
          <el-option label="AES-128" :value="128" />
          <el-option label="AES-192" :value="192" />
          <el-option label="AES-256" :value="256" />
        </el-select>
        <el-select v-model="aesFormat" class="keygen__select--sm" placeholder="格式">
          <el-option label="Base64" value="base64" />
          <el-option label="Hex" value="hex" />
        </el-select>
      </template>

      <!-- HMAC 选项 -->
      <template v-if="keyType === 'hmac'">
        <el-select v-model="hmacAlgo" class="keygen__select--sm" placeholder="算法">
          <el-option label="HMAC-MD5" value="md5" />
          <el-option label="HMAC-SHA1" value="sha1" />
          <el-option label="HMAC-SHA256" value="sha256" />
          <el-option label="HMAC-SHA512" value="sha512" />
        </el-select>
        <el-select v-model="hmacFormat" class="keygen__select--sm" placeholder="格式">
          <el-option label="Base64" value="base64" />
          <el-option label="Hex" value="hex" />
        </el-select>
      </template>

      <!-- Salt 选项 -->
      <template v-if="keyType === 'salt'">
        <el-select v-model="saltFormat" class="keygen__select--sm" placeholder="格式">
          <el-option label="Hex" value="hex" />
          <el-option label="Base64" value="base64" />
        </el-select>
        <el-input-number
          v-model="saltLen"
          :min="8"
          :max="4096"
          class="keygen__num"
          controls-position="right" />
        <span class="keygen__unit">bit</span>
      </template>

      <!-- Hash 选项 -->
      <template v-if="keyType === 'hash'">
        <el-select v-model="hashAlgo" class="keygen__select--sm" placeholder="算法">
          <el-option label="MD5" value="md5" />
          <el-option label="SHA1" value="sha1" />
          <el-option label="SHA256" value="sha256" />
          <el-option label="SHA512" value="sha512" />
        </el-select>
        <el-input-number
          v-model="hashLen"
          :min="4"
          :max="4096"
          class="keygen__num"
          controls-position="right" />
        <span class="keygen__unit">字符</span>
      </template>

      <!-- 批量数量（UUID 除外） -->
      <template v-if="keyType !== 'uuid'">
        <span class="keygen__label">数量</span>
        <el-input-number
          v-model="batchCount"
          :min="1"
          :max="1000"
          class="keygen__num keygen__num--sm"
          controls-position="right" />
      </template>
    </div>

    <!-- 操作按钮 -->
    <div class="keygen__actions">
      <el-button :disabled="!outputText" @click="copyAll">
        <span>复制结果</span>
      </el-button>
      <el-button :disabled="!outputText" @click="saveFile">
        <span>保存文件</span>
      </el-button>
      <el-button :disabled="!outputText" @click="clearAll">
        <span>清空</span>
      </el-button>
    </div>

    <!-- 结果区域 -->
    <div class="keygen__body">
      <div class="keygen__panel">
        <div class="keygen__panel-header">
          生成结果
          <span v-if="results.length > 1" class="keygen__count">共 {{ results.length }} 条</span>
        </div>
        <div class="keygen__editor">
          <div class="keygen__gutter" ref="gutterRef">{{ resultLines }}</div>
          <textarea
            v-model="outputText"
            class="keygen__textarea"
            placeholder="密钥将显示在这里"
            spellcheck="false"
            wrap="off"
            readonly
            @scroll="onGutterScroll($event, gutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
    </div>

    <FileStatusBar>
      <template v-if="error">
        <span class="keygen__inline">
          <b class="keygen__error">✕ {{ error }}</b>
        </span>
      </template>
      <template v-else-if="outputText">
        <span class="keygen__inline">
          <b class="keygen__ok">✓ 生成成功</b>
          <span class="keygen__sep">|</span>
          类型: <b>{{ currentTypeLabel }}</b>
          <span class="keygen__sep">|</span>
          数量: <b>{{ results.length }}</b>
          <span class="keygen__sep">|</span>
          总字符: <b>{{ totalChars }}</b>
        </span>
      </template>
      <template v-else>
        <span class="keygen__muted">选择密钥类型和参数后点击「生成密钥」</span>
      </template>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { computed, reactive, ref } from 'vue'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

const keyType = ref('random-string')
const outputText = ref('')
const results = ref([])
const error = ref('')
const generating = ref(false)
const batchCount = ref(1)

// 随机字符串
const strLen = ref(32)
const charset = reactive({
  digits: true,
  lowercase: true,
  uppercase: true,
  symbols: false,
  removeAmbiguous: false
})

// Base64
const base64Bits = ref(256)
const base64Custom = ref(128)
const base64UrlSafe = ref(false)

// Hex
const hexBits = ref(256)
const hexCustom = ref(128)

// AES
const aesBits = ref(256)
const aesFormat = ref('base64')

// HMAC
const hmacAlgo = ref('sha256')
const hmacFormat = ref('hex')

// Salt
const saltFormat = ref('hex')
const saltLen = ref(128)

// Hash
const hashAlgo = ref('sha256')
const hashLen = ref(32)

const gutterRef = ref(null)

function onGutterScroll(event, gutterEl) {
  if (gutterEl) gutterEl.scrollTop = event.target.scrollTop
}

const resultLines = computed(() => {
  const count = (outputText.value || ' ').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

const totalChars = computed(() => outputText.value.length)

const typeLabels = {
  'random-string': '随机字符串',
  uuid: 'UUID',
  base64: 'Base64 密钥',
  hex: 'Hex 密钥',
  aes: 'AES Key',
  hmac: 'HMAC Key',
  salt: 'Salt 盐值',
  hash: 'Hash 随机值'
}
const currentTypeLabel = computed(() => typeLabels[keyType.value] || keyType.value)

function onTypeChange() {
  error.value = ''
}

function buildParams() {
  const params = { type: keyType.value, count: batchCount.value }

  switch (keyType.value) {
    case 'random-string':
      params.length = strLen.value
      params.options = {
        digits: charset.digits,
        lowercase: charset.lowercase,
        uppercase: charset.uppercase,
        symbols: charset.symbols,
        removeAmbiguous: charset.removeAmbiguous
      }
      break
    case 'uuid':
      params.count = 1
      break
    case 'base64':
      params.length = base64Bits.value === 0 ? base64Custom.value : base64Bits.value
      params.options = { urlSafe: base64UrlSafe.value }
      break
    case 'hex':
      params.length = hexBits.value === 0 ? hexCustom.value : hexBits.value
      break
    case 'aes':
      params.length = aesBits.value
      params.options = { format: aesFormat.value }
      break
    case 'hmac':
      params.length = 256
      params.options = { algorithm: hmacAlgo.value, format: hmacFormat.value }
      break
    case 'salt':
      params.length = saltLen.value
      params.options = { format: saltFormat.value }
      break
    case 'hash':
      params.length = hashLen.value
      params.options = { algorithm: hashAlgo.value }
      break
  }

  return params
}

async function generate() {
  error.value = ''
  outputText.value = ''
  results.value = []
  generating.value = true

  try {
    const params = buildParams()
    const result = await window.api.generateRandomKeys(params)

    if (result.error) {
      error.value = result.error
    } else {
      results.value = result.results
      outputText.value = result.results.join('\n')
    }
  } catch (e) {
    error.value = '生成失败: ' + e.message
  } finally {
    generating.value = false
  }
}

async function copyAll() {
  if (!outputText.value) return
  try {
    await navigator.clipboard.writeText(outputText.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

async function saveFile() {
  if (!outputText.value) return
  try {
    const ext = keyType.value === 'uuid' ? 'txt' : 'txt'
    const defaultName = `key_${Date.now()}.${ext}`
    const filePath = await window.api.showSaveDialog(defaultName)
    if (!filePath) return

    await window.api.writeFile(filePath, outputText.value)
    ElMessage.success('文件已保存')
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  }
}

function clearAll() {
  outputText.value = ''
  results.value = []
  error.value = ''
}
</script>

<style scoped>
.keygen {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ===== 配置工具栏 ===== */
.keygen__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
  flex-wrap: wrap;
}

.keygen__select {
  width: 150px;
}

.keygen__select--type {
  width: 130px;
}

.keygen__select--sm {
  width: 130px;
}

.keygen__num {
  width: 110px;
}

.keygen__num--sm {
  width: 90px;
}

.keygen__unit {
  font-size: 13px;
  color: var(--text-secondary);
  margin-left: -4px;
}

.keygen__label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-left: 4px;
}

/* ===== 结果区域 ===== */
.keygen__body {
  display: flex;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.keygen__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.keygen__panel-header {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.keygen__count {
  color: #999;
  font-size: 12px;
}

.keygen__editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.keygen__editor:focus-within {
  border-color: #409eff;
}

.keygen__gutter {
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

.keygen__textarea {
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

.keygen__textarea::placeholder {
  color: #c0c4cc;
}

/* ===== 操作按钮 ===== */
.keygen__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 0;
  flex-shrink: 0;
}

/* ===== 状态提示 ===== */
.keygen__inline {
  display: flex;
  align-items: center;
}

.keygen__muted {
  color: #999;
}

.keygen__sep {
  color: #ddd;
  margin: 0 8px;
}

.keygen__ok {
  color: #67c23a;
}

.keygen__error {
  color: #f56c6c;
}

/* Element Plus checkbox 间距 */
.keygen__toolbar :deep(.el-checkbox) {
  margin-right: 4px;
}
</style>
