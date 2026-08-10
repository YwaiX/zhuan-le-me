<template>
  <div class="jwt">
    <!-- 工具栏 -->
    <div class="jwt__toolbar">
      <el-radio-group v-model="mode" @change="onModeChange">
        <el-radio-button value="encode">编码</el-radio-button>
        <el-radio-button value="decode">解码</el-radio-button>
        <el-radio-button value="verify">校验</el-radio-button>
      </el-radio-group>

      <template v-if="mode !== 'decode'">
        <span class="jwt__label">算法</span>
        <el-select v-model="algorithm" class="jwt__algo" @change="onAlgoChange">
          <el-option label="HS256" value="HS256" />
          <el-option label="HS384" value="HS384" />
          <el-option label="HS512" value="HS512" />
          <el-option label="RS256" value="RS256" />
          <el-option label="RS384" value="RS384" />
          <el-option label="RS512" value="RS512" />
          <el-option label="ES256" value="ES256" />
          <el-option label="ES384" value="ES384" />
          <el-option label="ES512" value="ES512" />
          <el-option label="EdDSA" value="EdDSA" />
          <el-option label="none" value="none" />
        </el-select>
      </template>

      <!-- 编码/解码/校验模式：按钮放在工具栏 -->
      <template v-if="mode === 'encode' || mode === 'decode' || mode === 'verify'">
        <el-button type="primary" :loading="operating" @click="execute">
          <span>{{ mode === 'encode' ? '生成 JWT' : mode === 'decode' ? '解码' : '校验签名' }}</span>
        </el-button>
        <el-button :disabled="!canCopy" @click="copyResult">
          <span>复制结果</span>
        </el-button>
        <el-button :disabled="!canClear" @click="clearAll">
          <span>清空</span>
        </el-button>
      </template>
    </div>

    <!-- ==================== 编码模式：左右分栏 ==================== -->
    <div v-if="mode === 'encode'" class="jwt__encode-body">
      <!-- 左侧：输入区域 -->
      <div class="jwt__encode-left">
        <div v-if="algorithm !== 'none'" class="jwt__editor-block jwt__editor-block--1">
          <div class="jwt__editor-label">{{ isHMAC ? 'Secret' : 'Private Key (PEM)' }}</div>
          <div class="jwt__mini-editor">
            <div class="jwt__mini-gutter" ref="keyGutterRef">{{ keyLines }}</div>
            <textarea
              v-model="secretKey"
              class="jwt__mini-textarea"
              :placeholder="keyPlaceholder"
              spellcheck="false"
              wrap="off"
              @scroll="onGutterScroll($event, keyGutterRef)"
              @keydown="onTabKey" />
          </div>
        </div>
        <div class="jwt__editor-block jwt__editor-block--2">
          <div class="jwt__editor-label">Header (JSON)</div>
          <div class="jwt__mini-editor">
            <div class="jwt__mini-gutter" ref="headerGutterRef">{{ headerLines }}</div>
            <textarea
              v-model="headerText"
              class="jwt__mini-textarea"
              spellcheck="false"
              wrap="off"
              @scroll="onGutterScroll($event, headerGutterRef)"
              @keydown="onTabKey" />
          </div>
        </div>
        <div class="jwt__editor-block jwt__editor-block--2">
          <div class="jwt__editor-label">Payload (JSON)</div>
          <div class="jwt__mini-editor">
            <div class="jwt__mini-gutter" ref="payloadGutterRef">{{ payloadLines }}</div>
            <textarea
              v-model="payloadText"
              class="jwt__mini-textarea"
              spellcheck="false"
              wrap="off"
              @scroll="onGutterScroll($event, payloadGutterRef)"
              @keydown="onTabKey" />
          </div>
        </div>
      </div>

      <!-- 右侧：结果展示 -->
      <div class="jwt__encode-right">
        <div class="jwt__editor-label">生成的 JWT Token</div>
        <div class="jwt__encode-result" :class="{ 'jwt__encode-result--empty': !result.token }">
          <div class="jwt__result-gutter" ref="resultGutterRef">{{ resultLines }}</div>
          <textarea
            v-model="result.token"
            class="jwt__result-textarea"
            :placeholder="resultPlaceholder"
            spellcheck="false"
            wrap="off"
            readonly
            @scroll="onGutterScroll($event, resultGutterRef)"
            @keydown="onTabKey" />
        </div>
      </div>
    </div>

    <!-- ==================== 解码模式：左右分栏 ==================== -->
    <div v-if="mode === 'decode'" class="jwt__encode-body">
      <div class="jwt__encode-left">
        <div class="jwt__editor-block jwt__editor-block--full">
          <div class="jwt__editor-label">JWT Token</div>
          <div class="jwt__mini-editor">
            <div class="jwt__mini-gutter" ref="tokenGutterRef">{{ tokenLines }}</div>
            <textarea
              v-model="jwtToken"
              class="jwt__mini-textarea"
              placeholder="粘贴 JWT Token，格式: xxxxx.yyyyy.zzzzz"
              spellcheck="false"
              wrap="off"
              @scroll="onGutterScroll($event, tokenGutterRef)"
              @keydown="onTabKey" />
          </div>
        </div>
      </div>
      <div class="jwt__encode-right">
        <template v-if="result.error">
          <div class="jwt__result jwt__result--error">
            <b class="jwt__error">✕ {{ result.error }}</b>
          </div>
        </template>
        <template v-else-if="result.header">
          <div class="jwt__decode-block jwt__decode-block--2">
            <div class="jwt__editor-label">Header</div>
            <div class="jwt__json-block">
              <pre>{{ formatJson(result.header) }}</pre>
            </div>
          </div>
          <div class="jwt__decode-block jwt__decode-block--2">
            <div class="jwt__editor-label">Payload</div>
            <div class="jwt__json-block">
              <pre>{{ formatJson(result.payload) }}</pre>
            </div>
          </div>
          <div class="jwt__decode-block jwt__decode-block--1">
            <div class="jwt__editor-label">Signature</div>
            <div class="jwt__sig-block">
              <code>{{ result.signature }}</code>
            </div>
          </div>
        </template>
        <div v-else class="jwt__empty">
          <span class="jwt__muted">粘贴 JWT Token 后点击解码</span>
        </div>
      </div>
    </div>

    <!-- ==================== 校验模式：左右分栏 ==================== -->
    <div v-if="mode === 'verify'" class="jwt__encode-body">
      <!-- 左侧：输入区域 -->
      <div class="jwt__encode-left">
        <div class="jwt__editor-block jwt__editor-block--2">
          <div class="jwt__editor-label">JWT Token</div>
          <div class="jwt__mini-editor">
            <div class="jwt__mini-gutter" ref="tokenGutterRef">{{ tokenLines }}</div>
            <textarea
              v-model="jwtToken"
              class="jwt__mini-textarea"
              placeholder="粘贴 JWT Token，格式: xxxxx.yyyyy.zzzzz"
              spellcheck="false"
              @scroll="onGutterScroll($event, tokenGutterRef)"
              @keydown="onTabKey" />
          </div>
        </div>
        <div v-if="algorithm !== 'none'" class="jwt__editor-block jwt__editor-block--1">
          <div class="jwt__editor-label">Public Key (PEM)</div>
          <div class="jwt__mini-editor">
            <div class="jwt__mini-gutter" ref="keyGutterRef">{{ keyLines }}</div>
            <textarea
              v-model="secretKey"
              class="jwt__mini-textarea"
              :placeholder="keyPlaceholder"
              spellcheck="false"
              @scroll="onGutterScroll($event, keyGutterRef)"
              @keydown="onTabKey" />
          </div>
        </div>
      </div>

      <!-- 右侧：结果展示 -->
      <div class="jwt__encode-right">
        <!-- 签名结果框：默认灰色，校验后变色 (flex:2) -->
        <div class="jwt__verify-block jwt__verify-block--2">
          <div class="jwt__editor-label">校验结果</div>
          <div
            class="jwt__verify-box"
            :class="verifyBoxClass">
            <div class="jwt__verify-box-inner">
              <span v-if="result.valid === undefined && !result.error && !operating">等待校验</span>
              <span v-else-if="result.error">✕ {{ result.error }}</span>
              <span v-else class="jwt__verify-main">{{ result.valid ? '✓ 签名验证通过' : '✗ 签名验证失败' }}</span>
              <div v-if="!result.valid && result.reason" class="jwt__verify-reason">
                {{ result.reason }}
              </div>
            </div>
          </div>
        </div>

        <!-- 时间校验 (flex:1) -->
        <div class="jwt__verify-block jwt__verify-block--1">
          <div class="jwt__editor-label">时间校验</div>
          <div class="jwt__verify-box jwt__verify-box--idle">
            <div class="jwt__time-list">
              <div
                v-for="tc in result.timeChecks"
                :key="tc.field"
                class="jwt__time-row"
                :class="tc.passed ? 'jwt__time--ok' : 'jwt__time--fail'">
                <span class="jwt__time-field">{{ tc.label }}</span>
                <span class="jwt__time-val">{{ formatTime(tc.value) }}</span>
                <span v-if="tc.message" class="jwt__time-msg">{{ tc.message }}</span>
              </div>
              <div v-if="!result.timeChecks || !result.timeChecks.length" class="jwt__time-row jwt__time-row--empty">
                <span class="jwt__muted">等待校验</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <FileStatusBar>
      <template v-if="error">
        <span class="jwt__inline">
          <b class="jwt__status-error">✕ {{ error }}</b>
        </span>
      </template>
      <template v-else-if="mode === 'encode' && result.token">
        <span class="jwt__inline">
          <b class="jwt__status-ok">✓ 生成成功</b>
          <span class="jwt__sep">|</span>
          算法: <b>{{ algorithm }}</b>
          <span class="jwt__sep">|</span>
          Token 长度: <b>{{ result.token.length }} 字符</b>
        </span>
      </template>
      <template v-else-if="mode === 'decode' && result.header">
        <span class="jwt__inline">
          <b class="jwt__status-ok">✓ 解码成功</b>
          <span class="jwt__sep">|</span>
          算法: <b>{{ result.header.alg || '未知' }}</b>
        </span>
      </template>
      <template v-else-if="mode === 'verify' && result.valid !== undefined">
        <span class="jwt__inline">
          <b :class="result.valid ? 'jwt__status-ok' : 'jwt__status-error'">
            {{ result.valid ? '✓ 签名有效' : '✗ 签名无效' }}
          </b>
        </span>
      </template>
      <template v-else>
        <span class="jwt__muted">{{ statusHint }}</span>
      </template>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { ElMessage } from 'element-plus'
import { computed, reactive, ref } from 'vue'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

const mode = ref('encode')
const algorithm = ref('HS256')
const secretKey = ref('')
const headerText = ref('')
const payloadText = ref('')
const jwtToken = ref('')
const operating = ref(false)
const error = ref('')
const result = reactive({ token: '', header: null, payload: null, signature: '', valid: undefined, reason: '', timeChecks: [] })

// gutter refs
const keyGutterRef = ref(null)
const resultGutterRef = ref(null)
const headerGutterRef = ref(null)
const payloadGutterRef = ref(null)
const tokenGutterRef = ref(null)

function onGutterScroll(event, gutterEl) {
  if (gutterEl) gutterEl.scrollTop = event.target.scrollTop
}

function countLines(text, fallback) { return (text || fallback || ' ').split('\n').length }
function makeLines(text, fallback) {
  return Array.from({ length: countLines(text, fallback) }, (_, i) => i + 1).join('\n')
}
const keyLines = computed(() => makeLines(secretKey.value, ' '))
const headerLines = computed(() => makeLines(headerText.value, ' '))
const payloadLines = computed(() => makeLines(payloadText.value, ' '))
const tokenLines = computed(() => makeLines(jwtToken.value, ' '))
const resultLines = computed(() => makeLines(result.token, ' '))

const isHMAC = computed(() => algorithm.value.startsWith('HS'))
const keyPlaceholder = computed(() => {
  if (isHMAC.value) return '输入 HMAC Secret 密钥...'
  return '粘贴 Private Key (PEM 格式)...\n\n-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----'
})
const resultPlaceholder = computed(() => operating.value ? '正在生成...' : '生成的 JWT Token 将显示在这里')

const hasResult = computed(() => {
  if (mode.value === 'encode') return !!result.token
  if (mode.value === 'decode') return !!result.header || !!result.error
  return result.valid !== undefined || !!result.error
})
const canCopy = computed(() => !!result.token || !!result.header || result.valid !== undefined)
const canClear = computed(() => canCopy.value || !!jwtToken.value || !!secretKey.value)

const statusHint = computed(() => {
  if (mode.value === 'encode') return '编辑 Header/Payload 后点击生成'
  if (mode.value === 'decode') return '粘贴 JWT Token 后点击解码'
  return '输入 JWT Token 和密钥后点击校验'
})

// 校验结果框样式
const verifyBoxClass = computed(() => {
  if (result.error) return 'jwt__verify-box--error'
  if (result.valid === true) return 'jwt__verify-box--ok'
  if (result.valid === false) return 'jwt__verify-box--fail'
  return 'jwt__verify-box--idle'
})

function formatTime(val) {
  if (!val) return ''
  const ms = typeof val === 'string' ? new Date(val).getTime() : typeof val === 'number' ? val * 1000 : val
  const d = new Date(ms)
  const pad = (n) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function initDefaults() {
  headerText.value = JSON.stringify({ alg: algorithm.value, typ: 'JWT' }, null, 2)
  const now = Math.floor(Date.now() / 1000)
  payloadText.value = JSON.stringify({
    sub: '123456',
    name: 'admin',
    iat: now,
    exp: now + 3600
  }, null, 2)
}

function onModeChange() {
  clearResult()
  if (mode.value === 'encode') initDefaults()
}

function onAlgoChange() {
  if (mode.value === 'encode') {
    try {
      const h = JSON.parse(headerText.value)
      h.alg = algorithm.value
      headerText.value = JSON.stringify(h, null, 2)
    } catch { /* ignore */ }
  }
}

function clearResult() {
  result.token = ''
  result.header = null
  result.payload = null
  result.signature = ''
  result.valid = undefined
  result.reason = ''
  result.timeChecks = []
  error.value = ''
}

function formatJson(obj) {
  if (!obj) return ''
  try {
    return JSON.stringify(obj, null, 2)
  } catch {
    return String(obj)
  }
}

async function execute() {
  error.value = ''
  clearResult()
  operating.value = true

  try {
    const params = { operation: mode.value, algorithm: algorithm.value }

    if (mode.value === 'encode') {
      try {
        params.header = JSON.parse(headerText.value)
      } catch {
        error.value = 'Header JSON 格式错误'
        operating.value = false
        return
      }
      try {
        params.payload = JSON.parse(payloadText.value)
      } catch {
        error.value = 'Payload JSON 格式错误'
        operating.value = false
        return
      }
      if (algorithm.value !== 'none' && !secretKey.value.trim()) {
        error.value = '请输入密钥'
        operating.value = false
        return
      }
      params.secret = secretKey.value
    }

    if (mode.value === 'decode') {
      if (!jwtToken.value.trim()) {
        error.value = '请输入 JWT Token'
        operating.value = false
        return
      }
      params.token = jwtToken.value.trim()
    }

    if (mode.value === 'verify') {
      if (!jwtToken.value.trim()) {
        error.value = '请输入 JWT Token'
        operating.value = false
        return
      }
      if (algorithm.value !== 'none' && !secretKey.value.trim()) {
        error.value = '请输入密钥'
        operating.value = false
        return
      }
      params.token = jwtToken.value.trim()
      params.secret = secretKey.value
    }

    const res = await window.api.jwtOperate(params)

    if (res.error) {
      error.value = res.error
    } else {
      Object.assign(result, res)
    }
  } catch (e) {
    error.value = '操作失败: ' + e.message
  } finally {
    operating.value = false
  }
}

async function copyResult() {
  let text = ''
  if (mode.value === 'encode' && result.token) {
    text = result.token
  } else if (mode.value === 'decode' && result.header) {
    text = [
      '=== Header ===',
      formatJson(result.header),
      '',
      '=== Payload ===',
      formatJson(result.payload),
      '',
      '=== Signature ===',
      result.signature
    ].join('\n')
  } else if (mode.value === 'verify' && result.valid !== undefined) {
    text = result.valid ? '✓ 签名验证通过' : '✗ 签名验证失败'
    if (result.timeChecks && result.timeChecks.length) {
      text += '\n\n时间校验:\n' + result.timeChecks.map(tc =>
        `  ${tc.label}: ${tc.value}${tc.message ? ' - ' + tc.message : ''}`
      ).join('\n')
    }
  }
  if (!text) return
  try {
    await navigator.clipboard.writeText(text)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

function clearAll() {
  jwtToken.value = ''
  secretKey.value = ''
  clearResult()
  if (mode.value === 'encode') initDefaults()
}

initDefaults()
</script>

<style scoped>
.jwt {
  display: flex;
  flex-direction: column;
  height: 100%;
}

/* ===== 工具栏 ===== */
.jwt__toolbar {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.jwt__label {
  font-size: 13px;
  color: var(--text-secondary);
}

.jwt__algo {
  width: 110px;
}

/* ===== 编码模式：左右分栏 ===== */
.jwt__encode-body {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 10px 16px;
}

.jwt__encode-left {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.jwt__encode-right {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-width: 0;
}

.jwt__encode-result {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.jwt__encode-result:focus-within {
  border-color: #409eff;
}

.jwt__encode-result--empty {
  background: #fafbfc;
}

.jwt__result-gutter {
  flex-shrink: 0;
  padding: 4px 6px;
  overflow: hidden;
  text-align: right;
  color: #999;
  background: #f5f7fa;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  user-select: none;
}

.jwt__result-textarea {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  background: transparent;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.jwt__result-textarea::placeholder {
  color: #c0c4cc;
}

/* ===== 编辑区域（编码左侧） ===== */
.jwt__editor-block {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.jwt__editor-block--1 {
  flex: 1;
}

.jwt__editor-block--2 {
  flex: 2;
}

.jwt__editor-block--full {
  flex: 1;
}

/* ===== 解码结果区域 ===== */
.jwt__decode-block {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.jwt__decode-block--1 {
  flex: 1;
}

.jwt__decode-block--2 {
  flex: 2;
}

.jwt__decode-block .jwt__json-block,
.jwt__decode-block .jwt__sig-block {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

.jwt__editor-label {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 4px;
  flex-shrink: 0;
}

.jwt__mini-editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.jwt__mini-editor:focus-within {
  border-color: #409eff;
}

.jwt__mini-gutter {
  flex-shrink: 0;
  padding: 4px 6px;
  overflow: hidden;
  text-align: right;
  color: #999;
  background: #f5f7fa;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  user-select: none;
}

.jwt__mini-textarea {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  background: #fff;
  overflow: auto;
  white-space: pre-wrap;
  overflow-wrap: break-word;
}

.jwt__mini-textarea::placeholder {
  color: #c0c4cc;
}

/* ===== 密钥区域（解码/校验模式） ===== */
.jwt__key-area {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 16px 0;
  flex-shrink: 0;
}

.jwt__key-area .jwt__label {
  padding-top: 4px;
  white-space: nowrap;
}

.jwt__key-editor {
  display: flex;
  flex: 1;
  min-height: 48px;
  max-height: 80px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.jwt__key-editor:focus-within {
  border-color: #409eff;
}

.jwt__key-gutter {
  flex-shrink: 0;
  padding: 4px 6px;
  overflow: hidden;
  text-align: right;
  color: #999;
  background: #f5f7fa;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  user-select: none;
}

.jwt__key-textarea {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: #333;
  background: #fff;
  overflow: auto;
  white-space: pre;
  overflow-wrap: normal;
}

.jwt__key-textarea::placeholder {
  color: #c0c4cc;
}

/* ===== Token 输入（解码/校验模式） ===== */
.jwt__token-area {
  padding: 10px 16px 0;
  flex-shrink: 0;
}

.jwt__token-editor {
  display: flex;
  height: 72px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.jwt__token-editor:focus-within {
  border-color: #409eff;
}

.jwt__token-gutter {
  flex-shrink: 0;
  padding: 4px 6px;
  overflow: hidden;
  text-align: right;
  color: #999;
  background: #f5f7fa;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.6;
  white-space: pre;
  user-select: none;
}

.jwt__token-textarea {
  flex: 1;
  min-width: 0;
  padding: 4px 6px;
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

.jwt__token-textarea::placeholder {
  color: #c0c4cc;
}

/* ===== 操作按钮（解码/校验模式） ===== */
.jwt__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px 0;
  flex-shrink: 0;
}

/* ===== 结果区域（解码/校验模式） ===== */
.jwt__body {
  flex: 1;
  min-height: 0;
  padding: 10px 16px;
  overflow: auto;
}

.jwt__result {
  margin-bottom: 10px;
}

.jwt__result--error {
  padding: 12px;
  background: #fef0f0;
  border-radius: 4px;
}

.jwt__result-label {
  font-size: 13px;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 4px;
}

.jwt__json-block {
  padding: 12px;
  background: #f5f7fa;
  border: 1px solid #e8ecf1;
  border-radius: 4px;
}

.jwt__json-block pre {
  margin: 0;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  color: #333;
  white-space: pre-wrap;
  word-break: break-all;
}

.jwt__sig-block {
  padding: 10px 12px;
  background: #f5f7fa;
  border: 1px solid #e8ecf1;
  border-radius: 4px;
  word-break: break-all;
}

.jwt__sig-block code {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #999;
}

/* 校验结果块 */
.jwt__verify-block {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.jwt__verify-block--1 {
  flex: 1;
}

.jwt__verify-block--2 {
  flex: 2;
}

.jwt__verify-box {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: center;
  padding: 24px;
  border-radius: 4px;
  border: 1px solid #e8ecf1;
  transition: background 0.3s, color 0.3s, border-color 0.3s;
  min-height: 0;
  overflow: hidden;
}

.jwt__verify-box-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  font-size: 20px;
  font-weight: 600;
}

.jwt__verify-box--idle {
  background: #fafbfc;
  color: #c0c4cc;
  border: 1px solid #e8ecf1;
}

.jwt__verify-box--ok {
  background: #f0f9eb;
  color: #67c23a;
  border: 1px solid #e1f3d8;
}

.jwt__verify-box--fail {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.jwt__verify-box--error {
  background: #fef0f0;
  color: #f56c6c;
  border: 1px solid #fde2e2;
}

.jwt__verify-reason {
  margin-top: 8px;
  font-size: 13px;
  font-weight: 400;
  color: #909399;
  flex-shrink: 0;
}


/* 时间校验列表 */
.jwt__time-list {
  flex: 1;
  min-height: 0;
  overflow: auto;
}

/* 时间校验框覆盖：减小内边距，内容顶部对齐 */
.jwt__verify-block--1 .jwt__verify-box {
  padding: 12px;
  justify-content: flex-start;
}

.jwt__time-row--empty {
  justify-content: center;
}

.jwt__time-row {
  display: flex;
  align-items: center;
  padding: 6px 10px;
  margin-top: 4px;
  font-size: 13px;
  border-radius: 3px;
  white-space: nowrap;
}

.jwt__time--ok {
  background: #f0f9eb;
  color: #67c23a;
}

.jwt__time--fail {
  background: #fef0f0;
  color: #f56c6c;
}

.jwt__time-field {
  font-weight: 600;
  min-width: 60px;
}

.jwt__time-val {
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 12px;
  color: #909399;
}

.jwt__time-msg {
  margin-left: auto;
}

/* 空状态 */
.jwt__empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

/* 状态栏 */
.jwt__inline {
  display: flex;
  align-items: center;
}

.jwt__muted {
  color: #999;
}

.jwt__sep {
  color: #ddd;
  margin: 0 8px;
}

.jwt__status-ok {
  color: #67c23a;
}

.jwt__status-error {
  color: #f56c6c;
}

.jwt__error {
  color: #f56c6c;
}
</style>
