// 配置格式转换编排层
// 源文本 ──parsers[sourceType]──► JS 对象 ──serializers[targetType]──► 目标文本
//
// 转换与格式化均返回结果对象而非抛异常，调用方据此决定是否覆盖已有结果

import { configRules } from '../../config/convertRules.js'
import {
  parseProperties,
  parsePropertiesComments,
  stringifyProperties,
  formatProperties
} from './propertiesUtils.js'
import { parseYaml, stringifyYaml, formatYaml } from './yamlUtils.js'
import { parseXml, stringifyXml, formatXml } from './xmlUtils.js'

const parsers = {
  properties: parseProperties,
  yml: parseYaml,
  json: JSON.parse,
  xml: parseXml
}

const serializers = {
  properties: stringifyProperties,
  yml: (data) => stringifyYaml(data),
  json: (data) => JSON.stringify(data, null, 2),
  xml: stringifyXml
}

const formatters = {
  properties: formatProperties,
  yml: formatYaml,
  json: (text) => JSON.stringify(JSON.parse(text), null, 2),
  xml: formatXml
}

// 由字符偏移量推算行列号（1 起）
function positionToLineColumn(text, position) {
  const lines = text.slice(0, position).split('\n')
  return { line: lines.length, column: lines[lines.length - 1].length + 1 }
}

// 把解析异常转成需求约定的中文提示
function normalizeError(type, error, content) {
  if (type === 'json') {
    const matched = /at position (\d+)/.exec(error.message)
    if (matched) {
      const { line, column } = positionToLineColumn(content, Number(matched[1]))
      return `JSON 格式错误，错误位置：第 ${line} 行，第 ${column} 列`
    }
    return 'JSON 格式错误，请检查语法'
  }
  if (type === 'yml') {
    const position = error.linePos?.[0]
    return position
      ? `YML 格式错误，错误位置：第 ${position.line} 行，第 ${position.col} 列`
      : 'YML 格式错误，请检查缩进或 YAML 语法'
  }
  if (type === 'xml') {
    return 'XML 格式错误，请检查标签是否正确闭合'
  }
  return 'Properties 格式错误，请检查属性名称及分隔符'
}

// 执行转换
// 返回 { success: true, content } 或 { success: false, error }
export function convertConfig({ sourceType, targetType, content }) {
  if (!configRules[sourceType]?.includes(targetType)) {
    return { success: false, error: '不支持的转换关系' }
  }

  let data
  try {
    data = parsers[sourceType](content)
  } catch (error) {
    return { success: false, error: normalizeError(sourceType, error, content) }
  }

  try {
    // Properties → YML 时把来源里的整行注释带到目标
    const result =
      sourceType === 'properties' && targetType === 'yml'
        ? stringifyYaml(data, parsePropertiesComments(content))
        : serializers[targetType](data)
    return { success: true, content: result }
  } catch (error) {
    return { success: false, error: `转换失败：${error.message}` }
  }
}

// 按格式格式化文本
// 返回 { success: true, content } 或 { success: false, error }
export function formatConfig(type, content) {
  const formatter = formatters[type]
  if (!formatter) {
    return { success: false, error: '不支持的格式' }
  }
  try {
    return { success: true, content: formatter(content) }
  } catch (error) {
    return { success: false, error: normalizeError(type, error, content) }
  }
}
