<template>
  <div class="code-fmt">
    <div class="code-fmt__toolbar">
      <el-button type="primary" @click="formatCode">
        <span>格式化</span>
      </el-button>
      <el-button :disabled="!code" @click="copyCode">
        <span>复制</span>
      </el-button>
      <el-button @click="clearCode">
        <span>清空</span>
      </el-button>
      <span class="code-fmt__lang">{{ langLabel }}</span>
    </div>
    <div class="code-fmt__body">
      <div class="code-fmt__editor">
        <div class="code-fmt__gutter" ref="gutterRef">{{ lineNumbers }}</div>
        <div class="code-fmt__highlight-wrapper">
          <pre
            ref="highlightRef"
            class="code-fmt__highlight"
            aria-hidden="true"><code v-html="highlightedHtml"
          /></pre>
          <textarea
            v-model="code"
            ref="areaRef"
            class="code-fmt__textarea"
            :placeholder="`在此粘贴 ${langLabel} 代码...`"
            spellcheck="false"
            wrap="off"
            @scroll="onScroll"
            @keydown="onTabKey"
          />
        </div>
      </div>
    </div>
    <FileStatusBar>
      <span v-if="code" class="code-fmt__inline">
        <b class="code-fmt__ok">{{ langLabel }}</b>
        <span class="code-fmt__sep">|</span>
        {{ codeSize }}
      </span>
      <span v-else class="code-fmt__muted">粘贴代码后点击格式化</span>
    </FileStatusBar>
  </div>
</template>

<script setup>
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { ElMessage } from 'element-plus'
import hljs from 'highlight.js/lib/common'
import dockerfileHljs from 'highlight.js/lib/languages/dockerfile'
import * as prettier from 'prettier/standalone'
import * as parserBabel from 'prettier/plugins/babel'
import * as parserEstree from 'prettier/plugins/estree'
import * as parserTypescript from 'prettier/plugins/typescript'
import * as parserYaml from 'prettier/plugins/yaml'
import { format as sqlFormat } from 'sql-formatter'
import xmlFormat from 'xml-formatter'
import 'highlight.js/styles/github.css'
import FileStatusBar from '../../components/FileStatusBar.vue'
import { useTabKey } from '../../composables/useTabKey'

const { onTabKey } = useTabKey()

hljs.registerLanguage('dockerfile', dockerfileHljs)

const route = useRoute()
const lang = computed(() => route.meta.lang || 'java')

const langMap = {
  java: 'Java',
  javascript: 'JavaScript',
  typescript: 'TypeScript',
  yaml: 'YAML',
  properties: 'Properties',
  sql: 'SQL',
  xml: 'XML',
  dockerfile: 'Dockerfile',
  nginx: 'Nginx'
}
const langLabel = computed(() => langMap[lang.value] || lang.value)

const hljsLangMap = {
  java: 'java',
  javascript: 'javascript',
  typescript: 'typescript',
  yaml: 'yaml',
  properties: 'ini',
  sql: 'sql',
  xml: 'xml',
  dockerfile: 'dockerfile',
  nginx: 'nginx'
}

const code = ref('')
const gutterRef = ref(null)
const highlightRef = ref(null)
const areaRef = ref(null)

// 切换语言时清空代码
watch(lang, () => {
  code.value = ''
})

const highlightedHtml = computed(() => {
  if (!code.value) return ''
  const langName = hljsLangMap[lang.value] || 'plaintext'
  try {
    const result = hljs.highlight(code.value, { language: langName })
    return result.value
  } catch {
    return hljs.highlightAuto(code.value).value
  }
})

const lineNumbers = computed(() => {
  const count = (code.value || '').split('\n').length
  return Array.from({ length: count }, (_, i) => i + 1).join('\n')
})

const codeSize = computed(() => {
  if (!code.value) return ''
  const bytes = new TextEncoder().encode(code.value).length
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(1)} KB`
})

function onScroll(event) {
  const top = event.target.scrollTop
  const left = event.target.scrollLeft
  if (gutterRef.value) gutterRef.value.scrollTop = top
  if (highlightRef.value) {
    highlightRef.value.scrollTop = top
    highlightRef.value.scrollLeft = left
  }
}

/* ============ 格式化引擎 ============ */

/* ---- 空行规则：变量间无空行、变量-方法间/方法-方法间有空行 ---- */
function classifyLine(line) {
  const trimmed = line.trim()
  if (!trimmed) return null
  // 跳过注释
  if (/^(\/\/|\/\*|\*[^\/]|\*\/)/.test(trimmed)) return null
  // 跳过注解
  if (/^@\w/.test(trimmed)) return null

  // 变量/字段：不含括号，以分号结尾
  if (!/[\(\)]/.test(trimmed) && /;\s*$/.test(trimmed) && line.length - line.trimStart().length >= 2) {
    return 'VAR'
  }
  // JS/TS 顶层 const/let/var
  if (/^(const|let|var)\s/.test(trimmed)) return 'VAR'

  // 方法/函数：含括号，以 { 结尾，非控制语句
  const isControl = /^(for|if|while|try|catch|switch|synchronized|else)\b/.test(trimmed)
  if (/\(/.test(trimmed) && /\{\s*$/.test(trimmed) && !isControl && line.length - line.trimStart().length >= 2) {
    return 'METHOD'
  }
  // JS/TS 顶层 function
  if (/^(async\s+)?function\s/.test(trimmed)) return 'METHOD'

  return null
}

function enforceBlankLines(formatted) {
  const lines = formatted.split('\n')
  const classified = lines.map(classifyLine)
  const result = []
  let prev = null

  for (let i = 0; i < lines.length; i++) {
    const cl = classified[i]

    if (cl) {
      if (prev) {
        // 去掉末尾所有空行
        while (result.length > 0 && result[result.length - 1].trim() === '') {
          result.pop()
        }
        if (prev === 'VAR' && cl === 'VAR') {
          // VAR → VAR：不加空行
        } else if (prev === 'VAR' && cl === 'METHOD') {
          result.push('') // VAR → METHOD：加一空行
        } else if (prev === 'METHOD' && cl === 'METHOD') {
          result.push('') // METHOD → METHOD：加一空行
        }
        // 其他转换保持原样
      }
      prev = cl
    }

    result.push(lines[i])
  }

  return result.join('\n')
}

/* ---- Prettier ---- */
const fmt = (parser, plugins) => async (text) => {
  const formatted = await prettier.format(text, { parser, plugins })
  return enforceBlankLines(formatted)
}

/* ---- Java：动态加载全量 prettier + prettier-plugin-java（依赖 WASM） ---- */
function preprocessJava(text) {
  // 1. JavaDoc */ 与后续代码分开：*/ public → */\npublic
  text = text.replace(/\*\/\s+(?=[a-zA-Z@])/g, '*/\n')
  // 2. 展开单行 JavaDoc 为多行格式
  text = text.replace(/\/\*\*\s+(.*?)\s*\*\//g, (_m, content) => {
    if (content.includes('\n')) return _m
    content = content.replace(/^\s*\*\s*/, '')
    const parts = content.split(/\s+\*\s+/)
    let result = '/**\n'
    for (const part of parts) {
      const trimmed = part.trim()
      result += trimmed ? ` * ${trimmed}\n` : ' *\n'
    }
    result += ' */'
    return result
  })
  return text
}

async function formatJava(text) {
  text = preprocessJava(text)
  const [prettierFull, javaPlugin] = await Promise.all([
    import('prettier'),
    import('prettier-plugin-java')
  ])
  const formatted = await prettierFull.format(text, {
    parser: 'java',
    plugins: [javaPlugin.default],
    printWidth: 120
  })
  return enforceBlankLines(formatted)
}

/* ---- sql-formatter ---- */
function formatSQL(text) {
  return sqlFormat(text, { language: 'sql' })
}

/* ---- xml-formatter ---- */
function formatXML(text) {
  return xmlFormat(text, { indentation: '  ' })
}

/* ---- 自定义：Dockerfile ---- */
function formatDockerfile(text) {
  const instructions = ['FROM', 'RUN', 'CMD', 'LABEL', 'MAINTAINER', 'EXPOSE', 'ENV',
    'ADD', 'COPY', 'ENTRYPOINT', 'VOLUME', 'USER', 'WORKDIR', 'ARG', 'ONBUILD',
    'STOPSIGNAL', 'HEALTHCHECK', 'SHELL']
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  instructions.forEach((inst) => {
    const re = new RegExp(`^\\s*${inst}\\b`, 'gim')
    result = result.replace(re, inst)
  })
  result = result.replace(/\n{3,}/g, '\n\n')
  return result.trim() + '\n'
}

/* ---- 自定义：Nginx ---- */
function indentLines(text, indentSize = 4) {
  const space = ' '.repeat(indentSize)
  let depth = 0
  return text.split('\n').map((line) => {
    const trimmed = line.trim()
    if (!trimmed) return ''
    if (/^[\}\]\)]/.test(trimmed)) depth = Math.max(0, depth - 1)
    const indented = space.repeat(depth) + trimmed
    const opens = (trimmed.match(/[\{\(\[]/g) || []).length
    const closes = (trimmed.match(/[\}\)\]]/g) || []).length
    depth += opens - closes
    if (depth < 0) depth = 0
    return indented
  }).join('\n')
}

function formatNginx(text) {
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  result = result.split('\n').map((l) => l.trimEnd()).join('\n')
  result = result.replace(/;/g, ';\n')
  return indentLines(result, 4).trim() + '\n'
}

/* ---- 自定义：Properties ---- */
function formatProperties(text) {
  let result = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n')
  result = result.split('\n').map((l) => l.trimEnd()).join('\n')
  result = result.replace(/\n{3,}/g, '\n\n')
  return result.trim() + '\n'
}

const formatters = {
  java: formatJava,
  javascript: fmt('babel', [parserBabel, parserEstree]),
  typescript: fmt('typescript', [parserTypescript, parserEstree]),
  yaml: fmt('yaml', [parserYaml]),
  properties: formatProperties,
  sql: formatSQL,
  xml: formatXML,
  dockerfile: formatDockerfile,
  nginx: formatNginx
}

async function formatCode() {
  if (!code.value) return
  const fn = formatters[lang.value]
  if (!fn) return
  try {
    code.value = await fn(code.value)
  } catch (e) {
    ElMessage.error(`格式化失败: ${e.message}`)
  }
}

async function copyCode() {
  if (!code.value) return
  try {
    await navigator.clipboard.writeText(code.value)
    ElMessage.success('已复制到剪贴板')
  } catch {
    ElMessage.error('复制失败')
  }
}

function clearCode() {
  code.value = ''
}
</script>

<style scoped>
.code-fmt {
  display: flex;
  flex-direction: column;
  height: 100%;
}

.code-fmt__toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 16px 16px 0;
  flex-shrink: 0;
}

.code-fmt__lang {
  margin-left: auto;
  font-size: 13px;
  color: var(--text-secondary);
}

.code-fmt__body {
  flex: 1;
  min-height: 0;
  padding: 12px 16px;
}

.code-fmt__editor {
  display: flex;
  height: 100%;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  overflow: hidden;
  background: #fff;
}

.code-fmt__editor:focus-within {
  border-color: #409eff;
}

.code-fmt__gutter {
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

.code-fmt__highlight-wrapper {
  position: relative;
  flex: 1;
  min-width: 0;
}

.code-fmt__highlight {
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

.code-fmt__highlight code {
  font-family: inherit;
  font-size: inherit;
  line-height: inherit;
}

.code-fmt__textarea {
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

.code-fmt__textarea::placeholder {
  color: #c0c4cc;
  font-family: inherit;
}

.code-fmt__inline {
  display: flex;
  align-items: center;
}

.code-fmt__muted {
  color: #999;
}

.code-fmt__sep {
  color: #ddd;
  margin: 0 8px;
}

.code-fmt__ok {
  color: #67c23a;
}
</style>
