// YAML 与 JS 对象互转（基于 yaml 包）
// 解析错误原样抛出（YAMLParseError 带 linePos），由 configConvert 统一转成中文提示

import { parse, stringify, Document } from 'yaml'

// 解析 YAML 文本为 JS 对象；标量（如纯文本、纯数字）不视为合法配置
export function parseYaml(text) {
  const data = parse(text)
  if (data === null || typeof data !== 'object') {
    throw new Error('内容不是有效的 YAML 结构')
  }
  return data
}

// 序列化为 YAML 文本；comments 为 { 顶层键: 注释文本 }，用于保留来源注释
export function stringifyYaml(data, comments) {
  if (!comments || Object.keys(comments).length === 0) {
    return stringify(data)
  }

  const doc = new Document(data)
  const items = doc.contents?.items
  if (Array.isArray(items)) {
    for (const pair of items) {
      const comment = comments[pair.key?.value]
      if (comment) pair.key.commentBefore = comment
    }
  }
  return doc.toString()
}

// 格式化：解析后重新序列化
export function formatYaml(text) {
  return stringify(parse(text))
}
