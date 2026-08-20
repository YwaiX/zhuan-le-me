<template>
  <div class="code-editor">
    <div class="code-editor__gutter" ref="gutterRef">{{ lineNumbers }}</div>
    <div class="code-editor__wrapper">
      <pre
        ref="highlightRef"
        class="code-editor__highlight"
        aria-hidden="true"><code v-html="highlightedHtml" /></pre>
      <textarea
        ref="areaRef"
        class="code-editor__textarea"
        :value="modelValue"
        :placeholder="placeholder"
        :readonly="readonly"
        spellcheck="false"
        wrap="off"
        @input="$emit('update:modelValue', $event.target.value)"
        @scroll="onScroll"
        @keydown="onKeydown" />
    </div>
  </div>
</template>

<script setup>
import { computed, ref } from 'vue'
import hljs from 'highlight.js/lib/common'
import 'highlight.js/styles/github.css'
import { useTabKey } from '../composables/useTabKey'

const props = defineProps({
  modelValue: { type: String, default: '' },
  // 配置格式名，空值表示不高亮
  language: { type: String, default: '' },
  placeholder: { type: String, default: '' },
  readonly: { type: Boolean, default: false }
})

defineEmits(['update:modelValue'])

const { onTabKey } = useTabKey()

const gutterRef = ref(null)
const highlightRef = ref(null)
const areaRef = ref(null)

// 配置格式对应的 highlight.js 语言（ini/yaml/xml/json 均在 common 包内）
const hljsLangMap = {
  properties: 'ini',
  yml: 'yaml',
  json: 'json',
  xml: 'xml'
}

function escapeHtml(text) {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// textarea 文字是透明的，实际可见的是高亮层。
// 未识别出格式时也要把原文渲染出来，否则内容不可见
const highlightedHtml = computed(() => {
  if (!props.modelValue) return ''
  const lang = hljsLangMap[props.language]
  if (!lang) return escapeHtml(props.modelValue)
  try {
    return hljs.highlight(props.modelValue, { language: lang }).value
  } catch {
    return escapeHtml(props.modelValue)
  }
})

const lineNumbers = computed(() => {
  const count = props.modelValue.split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

function onScroll(event) {
  const { scrollTop, scrollLeft } = event.target
  if (gutterRef.value) gutterRef.value.scrollTop = scrollTop
  if (highlightRef.value) {
    highlightRef.value.scrollTop = scrollTop
    highlightRef.value.scrollLeft = scrollLeft
  }
}

function onKeydown(event) {
  if (props.readonly) return
  onTabKey(event)
}
</script>

<style scoped>
.code-editor {
  display: flex;
  flex: 1;
  min-height: 0;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.code-editor:focus-within {
  border-color: #409eff;
}

.code-editor__gutter {
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

.code-editor__wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.code-editor__highlight {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 8px;
  overflow: hidden;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  white-space: pre;
  background: #fff;
  pointer-events: none;
}

.code-editor__highlight code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

.code-editor__textarea {
  position: relative;
  z-index: 1;
  display: block;
  width: 100%;
  height: 100%;
  padding: 8px;
  border: none;
  outline: none;
  resize: none;
  font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
  font-size: 13px;
  line-height: 1.6;
  color: transparent;
  caret-color: #333;
  background: transparent;
  overflow: auto;
  white-space: pre;
  overflow-wrap: normal;
}

.code-editor__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}
</style>
