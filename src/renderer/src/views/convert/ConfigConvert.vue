<template>
  <div class="config-convert">
    <div class="config-convert__toolbar">
      <div class="config-convert__toolbar-row">
        <el-button type="primary" :disabled="!canConvert" @click="handleConvert">
          <span>转换</span>
        </el-button>
        <el-button :disabled="!canFormat" @click="handleFormat">
          <span>格式化</span>
        </el-button>
        <el-button @click="handleOpenFile">
          <span>打开文件</span>
        </el-button>
        <el-button :disabled="!resultContent" @click="handleCopy">
          <span>复制结果</span>
        </el-button>
        <el-button :disabled="!resultContent" @click="handleDownload">
          <span>下载</span>
        </el-button>
        <el-button @click="handleClear">
          <span>清空</span>
        </el-button>
      </div>
      <div class="config-convert__toolbar-row">
        <span class="control-label">源格式</span>
        <span v-if="detectedType" class="config-convert__detected">
          ✓ {{ configFormatLabels[detectedType] }}
          <span class="config-convert__auto">自动识别</span>
        </span>
        <el-select
          v-else
          v-model="manualType"
          class="config-convert__select"
          placeholder="请指定"
          size="default">
          <el-option
            v-for="format in allFormats"
            :key="format"
            :label="configFormatLabels[format]"
            :value="format" />
        </el-select>

        <span class="control-label config-convert__label--target">目标格式</span>
        <el-select
          v-model="targetType"
          class="config-convert__select"
          placeholder="待识别"
          size="default"
          :disabled="targetOptions.length === 0">
          <el-option
            v-for="format in targetOptions"
            :key="format"
            :label="configFormatLabels[format]"
            :value="format" />
        </el-select>
      </div>
    </div>

    <div class="config-convert__panels">
      <div class="config-convert__panel" @dragover.prevent @drop.prevent="handleDrop">
        <div class="config-convert__panel-header">源内容</div>
        <CodeEditor
          :model-value="sourceContent"
          :language="sourceType || ''"
          placeholder="在此粘贴配置内容，或拖入 / 打开配置文件..."
          @update:model-value="handleSourceInput" />
      </div>
      <div class="config-convert__panel">
        <div class="config-convert__panel-header">转换结果</div>
        <CodeEditor
          v-model="resultContent"
          :language="resultType || ''"
          placeholder="转换结果将显示在这里"
          readonly />
      </div>
    </div>

    <FileStatusBar>
      <span v-if="errorMessage" class="config-convert__inline">
        <b class="config-convert__error">✕ 转换失败</b>
        <span class="config-convert__sep">|</span>
        {{ errorMessage }}
      </span>
      <span v-else-if="sourceType" class="config-convert__inline">
        <b class="config-convert__ok">✓ 已识别为 {{ configFormatLabels[sourceType] }}</b>
        <template v-if="resultContent">
          <span class="config-convert__sep">|</span>
          已转换为 {{ configFormatLabels[resultType] }}
          <span class="config-convert__sep">|</span>
          {{ resultSize }}
        </template>
      </span>
      <span v-else-if="sourceContent.trim()" class="config-convert__inline">
        <b class="config-convert__error">✕ 无法识别源格式</b>
        <span class="config-convert__sep">|</span>
        请检查输入内容，或手动指定格式
      </span>
      <span v-else class="config-convert__muted">等待输入内容</span>
    </FileStatusBar>

    <input
      ref="fileInputRef"
      type="file"
      accept=".properties,.yml,.yaml,.json,.xml"
      style="display: none"
      @change="handleFileChange" />
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import CodeEditor from '../../components/CodeEditor.vue'
import FileStatusBar from '../../components/FileStatusBar.vue'
import {
  configRules,
  configFormatLabels,
  configTargetExtensions
} from '../../config/convertRules.js'
import { convertConfig, formatConfig } from '../../utils/config/configConvert.js'
import { detectFormat, detectFormatByExtension } from '../../utils/config/configDetect.js'

const allFormats = Object.keys(configRules)

const sourceContent = ref('')
const resultContent = ref('')
// 结果对应的格式，与 targetType 分开保存，切换目标格式时右侧高亮不跟着乱变
const resultType = ref('')
const errorMessage = ref('')

const detectedType = ref(null)
const manualType = ref('')
const targetType = ref('')

const fileInputRef = ref(null)
// 下载时用于沿用原文件名
const sourceFileName = ref('')
// 内容直接来自文件且尚未编辑时的文件名，用于扩展名优先识别
let pristineFileName = null
let detectTimer = null

// 手动指定仅在自动识别失败时生效
const sourceType = computed(() => detectedType.value || manualType.value || null)

const targetOptions = computed(() => (sourceType.value ? configRules[sourceType.value] : []))

const canConvert = computed(
  () => !!sourceType.value && !!targetType.value && !!sourceContent.value.trim()
)

const canFormat = computed(() => !!sourceType.value && !!sourceContent.value.trim())

const resultSize = computed(() => {
  const bytes = new TextEncoder().encode(resultContent.value).length
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})

// 源内容变化后重新识别（需求：源内容变化重新执行格式识别）
watch(sourceContent, () => {
  clearTimeout(detectTimer)
  detectTimer = setTimeout(() => {
    const byExtension = pristineFileName ? detectFormatByExtension(pristineFileName) : null
    detectedType.value = byExtension || detectFormat(sourceContent.value).format
  }, 300)
})

// 自动识别成功后清掉手动指定，避免旧选择粘住
watch(detectedType, (value) => {
  if (value) manualType.value = ''
})

// 源格式变化后重建目标格式，当前选择不在新列表中时回到第一项
watch(
  targetOptions,
  (options) => {
    if (!options.includes(targetType.value)) {
      targetType.value = options[0] || ''
    }
  },
  { immediate: true }
)

// 用户编辑后文件扩展名不再权威，改回内容识别
function handleSourceInput(value) {
  pristineFileName = null
  sourceContent.value = value
}

function handleConvert() {
  const result = convertConfig({
    sourceType: sourceType.value,
    targetType: targetType.value,
    content: sourceContent.value
  })

  // 转换失败时保留上一次有效结果
  if (!result.success) {
    errorMessage.value = result.error
    return
  }
  errorMessage.value = ''
  resultContent.value = result.content
  resultType.value = targetType.value
}

function handleFormat() {
  const result = formatConfig(sourceType.value, sourceContent.value)
  if (!result.success) {
    ElMessage.error(result.error)
    return
  }
  sourceContent.value = result.content
}

async function loadFile(file) {
  const text = await file.text()
  sourceFileName.value = file.name
  pristineFileName = file.name
  sourceContent.value = text
}

function handleOpenFile() {
  fileInputRef.value.value = ''
  fileInputRef.value.click()
}

function handleFileChange(event) {
  const file = event.target.files[0]
  if (file) loadFile(file)
}

function handleDrop(event) {
  const file = event.dataTransfer.files[0]
  if (file) loadFile(file)
}

async function handleCopy() {
  try {
    await navigator.clipboard.writeText(resultContent.value)
    ElMessage.success('转换结果已复制')
  } catch {
    ElMessage.error('复制失败，请手动复制')
  }
}

async function handleDownload() {
  const extension = configTargetExtensions[resultType.value]
  const defaultName = sourceFileName.value
    ? sourceFileName.value.replace(/\.[^.]*$/, '') + extension
    : 'converted' + extension

  const savePath = await window.api.showSaveDialog(defaultName)
  if (!savePath) return

  try {
    await window.api.writeFile(savePath, resultContent.value)
    ElMessage.success('文件已保存')
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  }
}

function handleClear() {
  clearTimeout(detectTimer)
  sourceContent.value = ''
  resultContent.value = ''
  resultType.value = ''
  errorMessage.value = ''
  detectedType.value = null
  manualType.value = ''
  sourceFileName.value = ''
  pristineFileName = null
}
</script>

<style scoped>
.config-convert {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.config-convert__toolbar {
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.config-convert__toolbar-row {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.config-convert__select {
  width: 120px;
}

.control-label {
  font-size: 13px;
  color: #666;
  white-space: nowrap;
}

/* 与源格式一组拉开距离 */
.config-convert__label--target {
  margin-left: 16px;
}

.config-convert__detected {
  font-size: 13px;
  color: #67c23a;
  white-space: nowrap;
}

.config-convert__auto {
  color: #999;
  margin-left: 4px;
}

.config-convert__panels {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.config-convert__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.config-convert__panel-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.config-convert__inline {
  display: flex;
  align-items: center;
}

.config-convert__muted {
  color: #999;
}

.config-convert__sep {
  color: #ddd;
  margin: 0 8px;
}

.config-convert__ok {
  color: #67c23a;
}

.config-convert__error {
  color: #f56c6c;
}
</style>
