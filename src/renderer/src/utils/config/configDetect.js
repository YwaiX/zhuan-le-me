// 配置格式自动识别
// 优先按文件扩展名识别，无扩展名或识别不出时再按内容识别

import { parse } from 'yaml'
import { configExtensionMap } from '../../config/convertRules.js'
import { parseXml } from './xmlUtils.js'

// 根据文件名扩展名识别格式，识别不出返回 null
export function detectFormatByExtension(fileName) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  return configExtensionMap[ext] || null
}

function looksLikeXml(content) {
  if (!content.trim().startsWith('<')) return false
  try {
    parseXml(content)
    return true
  } catch {
    return false
  }
}

function looksLikeJson(content) {
  const trimmed = content.trim()
  if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) return false
  try {
    JSON.parse(content)
    return true
  } catch {
    return false
  }
}

// Properties 的判定：所有非空非注释行都是无缩进的 key=value / key:value，
// 且至少有一行用 = 分隔。缩进与分隔符这两条是把 Properties 和 YML 区分开的关键
function looksLikeProperties(content) {
  let entries = 0
  let equalSigns = 0

  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('!')) continue
    if (/^\s/.test(rawLine)) return false

    const matched = rawLine.match(/^([^\s=:]+)\s*([=:])/)
    if (!matched) return false
    entries++
    if (matched[2] === '=') equalSigns++
  }
  return entries > 0 && equalSigns > 0
}

// YAML 解析成标量（纯文本、纯数字）不算配置结构
function looksLikeYml(content) {
  try {
    const data = parse(content)
    return data !== null && typeof data === 'object'
  } catch {
    return false
  }
}

// 根据内容识别格式
// 返回 { success: true, format } 或 { success: false, format: null }
export function detectFormat(content) {
  if (!content || !content.trim()) {
    return { success: false, format: null }
  }
  if (looksLikeXml(content)) return { success: true, format: 'xml' }
  if (looksLikeJson(content)) return { success: true, format: 'json' }
  if (looksLikeProperties(content)) return { success: true, format: 'properties' }
  if (looksLikeYml(content)) return { success: true, format: 'yml' }
  return { success: false, format: null }
}
