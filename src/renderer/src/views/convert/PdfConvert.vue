<template>
  <div class="convert-tool">
    <!-- 顶部控件栏 -->
    <div class="convert-tool__controls">
      <div class="convert-tool__left">
        <span class="control-label">目标格式</span>
        <el-select
          v-model="targetFormat"
          @change="selectTargetFormat"
          placeholder="请先上传PDF"
          size="default"
          style="width: 120px"
          :disabled="availableTargets.length === 0"
        >
          <el-option v-for="fmt in availableTargets" :key="fmt" :label="fmt.toUpperCase()" :value="fmt" />
        </el-select>
      </div>

      <div class="convert-tool__right">
        <el-button
          type="primary"
          :disabled="!statusInfo.canConvert"
          :loading="converting"
          @click="startConvert"
        >
          开始转换
        </el-button>
        <el-button
          :disabled="statusInfo.status !== 'done'"
          @click="handleDownload"
        >
          下载
        </el-button>
      </div>
    </div>

    <!-- 上传区 / 文件卡片 -->
    <div class="convert-tool__upload">
      <el-upload
        v-if="!file"
        ref="uploadRef"
        class="upload-drag"
        drag
        :auto-upload="false"
        :limit="1"
        :on-change="onFileChange"
        accept=".pdf"
      >
        <div class="upload-drag__placeholder">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#ccc" stroke-width="1.5">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
            <polyline points="14 2 14 8 20 8" />
            <line x1="16" y1="13" x2="8" y2="13" />
            <line x1="16" y1="17" x2="8" y2="17" />
          </svg>
          <p class="upload-drag__text">拖拽PDF文件到此处或点击上传</p>
        </div>
      </el-upload>

      <div
        v-else
        class="file-preview"
        @click="triggerReplace"
        @dragover.prevent
        @drop.prevent="onReplaceDrop"
      >
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="#e6a23c" stroke-width="1.5">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <polyline points="14 2 14 8 20 8" />
        </svg>
        <p class="file-preview__name">{{ fileName }}</p>
        <p class="file-preview__meta">{{ fileSize }} · {{ fileExt.toUpperCase() }}</p>
        <p class="file-preview__hint">点击或拖拽文件替换</p>
      </div>
      <input
        ref="replaceInput"
        type="file"
        accept=".pdf"
        style="display:none"
        @change="onReplaceFile"
      />
    </div>

    <FileStatusBar
      :status="statusInfo.status"
      :file-name="fileName"
      :file-ext="fileExt"
      :file-size="fileSize"
      :progress="progress"
      :output-file="resultFile"
      :error-message="statusInfo.errorMessage"
    />
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { ElMessage } from 'element-plus'
import { useFileConvert } from '../../composables/useFileConvert.js'
import { pdfRules, pdfTypeExtensions } from '../../config/convertRules.js'
import { dispatchPdfConvert } from '../../utils/pdfUtils.js'
import FileStatusBar from '../../components/FileStatusBar.vue'

const {
  selectedType,
  file,
  targetFormat,
  converting,
  progress,
  resultFile,
  resultBlob,
  fileName,
  fileExt,
  fileSize,
  availableTargets,
  statusInfo,
  setFile,
  clearFile,
  selectTargetFormat,
  startConvert
} = useFileConvert(pdfRules, null, pdfTypeExtensions, {
  strictType: false,
  convertFn: (fileObj, targetFmt, onProgress) => {
    onProgress(10)
    return dispatchPdfConvert(fileObj, targetFmt).then((blob) => {
      onProgress(100)
      return blob
    })
  }
})

const replaceInput = ref(null)

function onFileChange(uploadFile) {
  if (!uploadFile.raw) return
  setFile(uploadFile.raw)
  selectedType.value = 'pdf'
}

function triggerReplace() {
  if (converting.value) return
  replaceInput.value?.click()
}

function onReplaceFile(e) {
  if (converting.value) return
  const f = e.target.files?.[0]
  if (f) { setFile(f); selectedType.value = 'pdf' }
  e.target.value = ''
}

function onReplaceDrop(e) {
  if (converting.value) return
  const f = e.dataTransfer?.files?.[0]
  if (f) { setFile(f); selectedType.value = 'pdf' }
}

async function handleDownload() {
  const savePath = await window.api.showSaveDialog(resultFile.value)
  if (!savePath) return

  try {
    const buffer = resultBlob.value
      ? await resultBlob.value.arrayBuffer()
      : await file.value.arrayBuffer()
    await window.api.writeFile(savePath, Array.from(new Uint8Array(buffer)))
    ElMessage.success('文件已保存')
  } catch (e) {
    ElMessage.error('保存失败: ' + e.message)
  }
}
</script>

<style scoped>
.convert-tool {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.convert-tool__controls {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid #f0f0f0;
}

.convert-tool__left {
  display: flex;
  align-items: center;
}

.convert-tool__right {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
}

.control-label {
  font-size: 13px;
  color: #666;
  margin: 0 8px 0 0;
  white-space: nowrap;
}

.control-label + .el-select {
  margin-right: 16px;
}

.convert-tool__upload {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-drag {
  width: 100%;
  height: 100%;
}

.upload-drag :deep(.el-upload) {
  width: 100%;
  height: 100%;
}

.upload-drag :deep(.el-upload-dragger) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}

.upload-drag__placeholder {
  text-align: center;
}

.upload-drag__text {
  margin-top: 8px;
  font-size: 14px;
  color: #666;
}

.upload-drag__hint {
  margin-top: 4px;
  font-size: 12px;
  color: #bbb;
}

.file-preview {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
  cursor: pointer;
  user-select: none;
}

.file-preview__name {
  margin-top: 12px;
  font-size: 15px;
  font-weight: 600;
  color: #333;
  max-width: 80%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.file-preview__meta {
  margin-top: 4px;
  font-size: 13px;
  color: #999;
}

.file-preview__hint {
  margin-top: 8px;
  font-size: 12px;
  color: #ccc;
}
</style>
