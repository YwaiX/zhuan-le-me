<template>
  <div class="status-bar" :class="!$slots.default ? `status-bar--${status}` : ''">
    <!-- 通用模式：使用插槽自定义内容 -->
    <slot v-if="$slots.default" />
    <!-- 文件转换模式：保留原有逻辑 -->
    <template v-else>
      <!-- 待上传 -->
      <span v-if="status === 'idle'" class="status-bar__muted">等待上传文件</span>

      <!-- 待处理 -->
      <span v-else-if="status === 'ready'" class="status-bar__inline">
        文件: <b>{{ fileName }}</b>
        <span class="status-bar__sep">|</span>
        类型: <b>{{ fileExt }}</b>
        <span class="status-bar__sep" v-if="fileSize">|</span>
        <template v-if="fileSize">大小: <b>{{ fileSize }}</b></template>
        <span class="status-bar__sep">|</span>
        状态: <b class="status-bar__ready">待处理</b>
      </span>

      <!-- 处理中 -->
      <span v-else-if="status === 'processing'" class="status-bar__inline">
        正在转换...
        <el-progress
          class="status-bar__progress"
          :percentage="progress"
          :stroke-width="6"
          :show-text="false"
        />
        <b>{{ progress }}%</b>
      </span>

      <!-- 处理完成 -->
      <span v-else-if="status === 'done'" class="status-bar__inline">
        <b class="status-bar__done">✓ 转换完成</b>
        <span class="status-bar__sep">→</span>
        {{ outputFile }}
      </span>

      <!-- 处理失败 / 文件类型异常 -->
      <span v-else-if="status === 'error' || status === 'type-error'" class="status-bar__inline status-bar__inline--grow">
        <b class="status-bar__error">✗ {{ errorTitle }}</b>
        <span class="status-bar__sep">|</span>
        <span class="status-bar__error-text">{{ errorMessage }}</span>
        <button class="status-bar__copy" title="复制错误信息" @click="copyError">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
        </button>
      </span>
    </template>
  </div>
</template>

<script setup>
import { computed } from 'vue'
import { ElMessage } from 'element-plus'

const props = defineProps({
  status: { type: String, default: 'idle' },
  fileName: { type: String, default: '' },
  fileExt: { type: String, default: '' },
  fileSize: { type: String, default: '' },
  progress: { type: Number, default: 0 },
  outputFile: { type: String, default: '' },
  errorMessage: { type: String, default: '' }
})

const errorTitle = computed(() => (props.status === 'type-error' ? '文件类型异常' : '处理失败'))

async function copyError() {
  try {
    await window.api.copyText(props.errorMessage)
    ElMessage.success('错误信息已复制')
  } catch (e) {
    ElMessage.error('复制失败')
  }
}
</script>

<style scoped>
.status-bar {
  display: flex;
  align-items: center;
  height: 36px;
  min-height: 36px;
  padding: 0 16px;
  background: #fafbfc;
  border-top: 1px solid #e8ecf1;
  font-size: 13px;
  overflow: hidden;
  white-space: nowrap;
}

.status-bar__muted {
  color: #999;
}

.status-bar__inline {
  display: flex;
  align-items: center;
  gap: 0;
}

.status-bar__sep {
  color: #ddd;
  margin: 0 8px;
}

.status-bar__ready {
  color: #409eff;
}

.status-bar__done {
  color: #67c23a;
}

.status-bar__error {
  color: #f56c6c;
}

.status-bar__progress {
  display: inline-flex;
  width: 120px;
  margin: 0 8px;
  vertical-align: middle;
}

.status-bar__inline--grow {
  flex: 1;
  min-width: 0;
}

.status-bar__error-text {
  flex: 1;
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.status-bar__copy {
  flex-shrink: 0;
  margin-left: 8px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 4px;
  border: none;
  background: transparent;
  color: #909399;
  cursor: pointer;
}

.status-bar__copy:hover {
  color: #409eff;
}
</style>
