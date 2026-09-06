<template>
  <div class="keypair">
    <div class="keypair__toolbar">
      <div class="keypair__toolbar-row">
        <el-button type="primary" :loading="generating" @click="generate">
          <span>生成密钥对</span>
        </el-button>
        <el-select
          v-model="algorithm"
          class="keypair__select"
          placeholder="算法"
          @change="onAlgorithmChange">
          <el-option label="RSA" value="RSA" />
          <el-option label="DSA" value="DSA" />
          <el-option label="SM2" value="SM2" />
          <el-option label="ECC" value="EC" />
          <el-option label="EDDSA" value="EDDSA" />
        </el-select>
        <el-select
          v-model="selectedKeyLength"
          class="keypair__select"
          placeholder="密钥长度"
          :disabled="algorithm === 'SM2'">
          <el-option
            v-for="opt in keyLengthOptions"
            :key="opt.value"
            :label="opt.label"
            :value="opt.value" />
        </el-select>
        <el-select
          v-model="outputFormat"
          class="keypair__select"
          placeholder="输出格式">
          <el-option label="PEM" value="PEM" />
          <el-option label="HEX" value="HEX" />
        </el-select>
      </div>
      <div class="keypair__toolbar-row">
        <el-button :disabled="!publicKey" @click="copyKey('public')">
          <span>复制公钥</span>
        </el-button>
        <el-button :disabled="!publicKey" @click="copyKey('private')">
          <span>复制私钥</span>
        </el-button>
        <el-button :disabled="!publicKey" @click="clearAll">
          <span>清空</span>
        </el-button>
      </div>
    </div>
    <div class="keypair__panels">
      <div class="keypair__panel">
        <div class="keypair__panel-header">公钥</div>
        <div class="keypair__editor">
          <div class="keypair__gutter" ref="pubGutterRef">{{ pubLines }}</div>
          <textarea
            v-model="publicKey"
            class="keypair__textarea"
            placeholder="生成公钥将显示在这里"
            spellcheck="false"
            wrap="off"
            readonly
            @scroll="onGutterScroll($event, pubGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
      <div class="keypair__panel">
        <div class="keypair__panel-header">私钥</div>
        <div class="keypair__editor">
          <div class="keypair__gutter" ref="priGutterRef">{{ priLines }}</div>
          <textarea
            v-model="privateKey"
            class="keypair__textarea"
            placeholder="生成私钥将显示在这里"
            spellcheck="false"
            wrap="off"
            readonly
            @scroll="onGutterScroll($event, priGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
    </div>
    <FileStatusBar>
      <template v-if="error">
        <span class="keypair__inline">
          <b class="keypair__error">✕ {{ error }}</b>
        </span>
      </template>
      <template v-else-if="publicKey">
        <span class="keypair__inline">
          <b class="keypair__ok">✓ 生成成功</b>
          <span class="keypair__sep">|</span>
          算法: <b>{{ algorithm }}</b>
          <span class="keypair__sep">|</span>
          密钥长度: <b>{{ currentKeyLengthLabel }}</b>
          <span class="keypair__sep">|</span>
          输出格式: <b>{{ outputFormat }}</b>
        </span>
      </template>
      <template v-else>
        <span class="keypair__muted">选择算法和参数后点击「生成密钥对」</span>
      </template>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

const algorithm = ref('RSA')
const outputFormat = ref('PEM')
const publicKey = ref('')
const privateKey = ref('')
const error = ref('')
const generating = ref(false)
const selectedKeyLength = ref('2048')

const pubGutterRef = ref(null)
const priGutterRef = ref(null)

function onGutterScroll(event, gutterEl) {
  if (gutterEl) {
    gutterEl.scrollTop = event.target.scrollTop
  }
}

const pubLines = computed(() => {
  const count = (publicKey.value || ' ').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

const priLines = computed(() => {
  const count = (privateKey.value || ' ').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

// 密钥长度/曲线配置
const keyLengthConfig = {
  RSA: [
    { label: '1024 bit', value: '1024' },
    { label: '2048 bit (推荐)', value: '2048' },
    { label: '3072 bit', value: '3072' },
    { label: '4096 bit', value: '4096' }
  ],
  DSA: [
    { label: '1024 bit', value: '1024' },
    { label: '2048 bit (推荐)', value: '2048' },
    { label: '3072 bit', value: '3072' }
  ],
  EC: [
    { label: '256 bit · prime256v1 (推荐)', value: 'prime256v1' },
    { label: '384 bit · secp384r1', value: 'secp384r1' },
    { label: '521 bit · secp521r1', value: 'secp521r1' }
  ],
  SM2: [
    { label: '256 bit (固定)', value: '256' }
  ],
  EDDSA: [
    { label: 'Ed25519 · 256 bit', value: 'ed25519' },
    { label: 'Ed448 · 456 bit', value: 'ed448' }
  ]
}

const keyLengthOptions = computed(() => {
  return keyLengthConfig[algorithm.value] || []
})

// 算法切换时重置选中值
function onAlgorithmChange() {
  const opts = keyLengthConfig[algorithm.value]
  if (opts && opts.length > 0) {
    selectedKeyLength.value = opts[0].value
  }
}

// 监听算法变化，确保 keyLength 有效
watch(algorithm, () => {
  onAlgorithmChange()
})

const currentKeyLengthLabel = computed(() => {
  const opts = keyLengthConfig[algorithm.value]
  if (!opts) return selectedKeyLength.value
  const opt = opts.find((o) => o.value === selectedKeyLength.value)
  return opt ? opt.label : selectedKeyLength.value
})

async function generate() {
  error.value = ''
  publicKey.value = ''
  privateKey.value = ''
  generating.value = true

  try {
    const params = {
      algorithm: algorithm.value,
      keyLength: algorithm.value === 'SM2' ? 256 : parseInt(selectedKeyLength.value) || selectedKeyLength.value,
      curve: algorithm.value === 'EC' || algorithm.value === 'EDDSA' ? selectedKeyLength.value : undefined,
      format: outputFormat.value
    }

    const result = await window.api.generateKeyPair(params)

    if (result.error) {
      error.value = result.error
    } else {
      publicKey.value = result.publicKey
      privateKey.value = result.privateKey
    }
  } catch (e) {
    error.value = '生成失败: ' + e.message
  } finally {
    generating.value = false
  }
}

async function copyKey(type) {
  const text = type === 'public' ? publicKey.value : privateKey.value
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success(type === 'public' ? '公钥已复制到剪贴板' : '私钥已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

function clearAll() {
  publicKey.value = ''
  privateKey.value = ''
  error.value = ''
}
</script>

<style scoped>
.keypair {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.keypair__toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.keypair__toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.keypair__select {
  width: 220px;
}

.keypair__panels {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.keypair__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.keypair__panel-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.keypair__editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.keypair__editor:focus-within {
  border-color: #409eff;
}

.keypair__gutter {
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

.keypair__textarea {
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

.keypair__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}

.keypair__inline {
  display: flex;
  align-items: center;
}

.keypair__muted {
  color: #999;
}

.keypair__sep {
  color: #ddd;
  margin: 0 8px;
}

.keypair__ok {
  color: #67c23a;
}

.keypair__error {
  color: #f56c6c;
}
</style>
