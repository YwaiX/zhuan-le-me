<template>
  <div class="json-diff">
    <div class="json-diff__toolbar">
      <el-button @click="swapSides">
        <span>交换</span>
      </el-button>
      <el-button @click="clearAll">
        <span>清空</span>
      </el-button>
    </div>
    <div class="json-diff__panels">
      <div class="json-diff__panel">
        <div class="json-diff__panel-header">原始代码</div>
        <div class="json-diff__editor">
          <div class="json-diff__gutter" ref="leftGutterRef">
            <div
              v-for="(item, i) in leftDiffLines"
              :key="i"
              class="json-diff__gutter-line"
              :class="{ 'json-diff__gutter-line--diff': !item.same }">
              {{ i + 1 }}
            </div>
          </div>
          <div class="json-diff__code-area">
            <div class="json-diff__highlights" ref="leftHighlightRef" aria-hidden="true">
              <div
                v-for="(item, i) in leftDiffLines"
                :key="i"
                class="json-diff__hl-line"
                :class="{ 'json-diff__hl-line--diff': !item.same }" />
            </div>
            <textarea
              v-model="leftText"
              class="json-diff__textarea"
              placeholder="在此粘贴原始代码..."
              spellcheck="false"
              wrap="off"
              @scroll="onCodeScroll($event, leftGutterRef, leftHighlightRef)"
              @keydown="onTabKey" />
          </div>
        </div>
      </div>
      <div class="json-diff__panel">
        <div class="json-diff__panel-header">对比代码</div>
        <div class="json-diff__editor">
          <div class="json-diff__gutter" ref="rightGutterRef">
            <div
              v-for="(item, i) in rightDiffLines"
              :key="i"
              class="json-diff__gutter-line"
              :class="{ 'json-diff__gutter-line--diff': !item.same }">
              {{ i + 1 }}
            </div>
          </div>
          <div class="json-diff__code-area">
            <div class="json-diff__highlights" ref="rightHighlightRef" aria-hidden="true">
              <div
                v-for="(item, i) in rightDiffLines"
                :key="i"
                class="json-diff__hl-line"
                :class="{ 'json-diff__hl-line--diff': !item.same }" />
            </div>
            <textarea
              v-model="rightText"
              class="json-diff__textarea"
              placeholder="在此粘贴对比代码..."
              spellcheck="false"
              wrap="off"
              @scroll="onCodeScroll($event, rightGutterRef, rightHighlightRef)"
              @keydown="onTabKey" />
          </div>
        </div>
      </div>
    </div>
    <FileStatusBar>
      <template v-if="leftText || rightText">
        <span class="json-diff__inline">
          <b :class="diffCount === 0 ? 'json-diff__ok' : 'json-diff__error'">
            {{ diffCount === 0 ? '✓ 完全一致' : `✕ ${diffCount} 行不同` }}
          </b>
          <span class="json-diff__sep">|</span>
          左侧 {{ leftLineCount }} 行
          <span class="json-diff__sep">|</span>
          右侧 {{ rightLineCount }} 行
        </span>
      </template>
      <template v-else>
        <span class="json-diff__muted">输入代码后自动对比</span>
      </template>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

const leftText = ref('')
const rightText = ref('')

const leftGutterRef = ref(null)
const rightGutterRef = ref(null)
const leftHighlightRef = ref(null)
const rightHighlightRef = ref(null)

function onCodeScroll(event, gutterEl, highlightEl) {
  const top = event.target.scrollTop
  if (gutterEl) gutterEl.scrollTop = top
  if (highlightEl) highlightEl.scrollTop = top
}

const leftLines = computed(() => (leftText.value || '').split('\n'))
const rightLines = computed(() => (rightText.value || '').split('\n'))

const leftLineCount = computed(() => leftLines.value.length)
const rightLineCount = computed(() => rightLines.value.length)

const leftDiffLines = computed(() => {
  const left = leftLines.value
  const right = rightLines.value
  const maxLen = Math.max(left.length, right.length)
  const result = []
  for (let i = 0; i < maxLen; i++) {
    const leftLine = i < left.length ? left[i] : undefined
    const rightLine = i < right.length ? right[i] : undefined
    result.push({
      same: leftLine !== undefined && rightLine !== undefined && leftLine === rightLine
    })
  }
  return result
})

const rightDiffLines = computed(() => {
  const left = leftLines.value
  const right = rightLines.value
  const maxLen = Math.max(left.length, right.length)
  const result = []
  for (let i = 0; i < maxLen; i++) {
    const leftLine = i < left.length ? left[i] : undefined
    const rightLine = i < right.length ? right[i] : undefined
    result.push({
      same: leftLine !== undefined && rightLine !== undefined && leftLine === rightLine
    })
  }
  return result
})

const diffCount = computed(() => {
  return leftDiffLines.value.filter((l) => !l.same).length
})

function swapSides() {
  const tmp = leftText.value
  leftText.value = rightText.value
  rightText.value = tmp
}

function clearAll() {
  leftText.value = ''
  rightText.value = ''
}
</script>

<style scoped>
.json-diff {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.json-diff__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.json-diff__panels {
  display: flex;
  gap: 12px;
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.json-diff__panel {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
}

.json-diff__panel-header {
  font-size: 13px;
  color: var(--text-secondary);
  margin-bottom: 6px;
}

.json-diff__editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.json-diff__editor:focus-within {
  border-color: #409eff;
}

/* ---- 行号列 ---- */
.json-diff__gutter {
  flex-shrink: 0;
  overflow: hidden;
  background: #f5f7fa;
  user-select: none;
}

.json-diff__gutter-line {
  height: calc(13px * 1.6);
  line-height: 1.6;
  padding: 0 8px;
  text-align: right;
  color: #999;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  white-space: nowrap;
}

.json-diff__gutter-line--diff {
  color: #f56c6c;
}

/* ---- 代码区（高亮层 + textarea） ---- */
.json-diff__code-area {
  position: relative;
  flex: 1;
  min-width: 0;
  overflow: hidden;
}

.json-diff__highlights {
  position: absolute;
  inset: 0;
  overflow: hidden;
  pointer-events: none;
}

.json-diff__hl-line {
  height: calc(13px * 1.6);
}

.json-diff__hl-line--diff {
  background: #fde2e2;
}

.json-diff__textarea {
  position: relative;
  display: block;
  width: 100%;
  height: 100%;
  padding: 0 8px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: #333;
  background: transparent;
  overflow: auto;
  white-space: pre;
  overflow-wrap: normal;
}

.json-diff__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}

/* ---- 状态栏 ---- */
.json-diff__inline {
  display: flex;
  align-items: center;
}

.json-diff__muted {
  color: #999;
}

.json-diff__sep {
  color: #ddd;
  margin: 0 8px;
}

.json-diff__ok {
  color: #67c23a;
}

.json-diff__error {
  color: #f56c6c;
}
</style>
