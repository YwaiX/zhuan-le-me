// XML 与 JS 对象互转
//
// 数据模型约定（需求文档 26 节）：
//   @xxx   → XML 属性
//   #text  → XML 文本
//   重复节点 ↔ JSON 数组
//
// 已知限制：单元素数组转成 XML 后只剩一个节点，读回时不再是数组
//（XML 无法表达「仅出现一次的重复节点」）

import xmlFormat from 'xml-formatter'

const XML_DECLARATION = '<?xml version="1.0" encoding="UTF-8"?>'

const FORMAT_OPTIONS = {
  indentation: '  ',
  collapseContent: true,
  lineSeparator: '\n'
}

// 文本节点转义
function escapeText(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

// 属性值转义（属性用双引号包裹，需额外转义引号）
function escapeAttr(value) {
  return String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
}

// 解析文本，解析失败抛错。必须用 application/xml，text/html 会容错而不报错
function parseDocument(text) {
  const doc = new DOMParser().parseFromString(text, 'application/xml')
  if (doc.getElementsByTagName('parsererror').length > 0 || !doc.documentElement) {
    throw new Error('XML 解析失败')
  }
  return doc
}

// 元素转为 JS 值。注意全程不做数字推断，XML 文本一律保持字符串
function elementToValue(element) {
  const attributes = {}
  for (const attr of element.attributes) {
    attributes['@' + attr.name] = attr.value
  }
  const hasAttributes = Object.keys(attributes).length > 0
  const childElements = Array.from(element.children)

  // 无子元素：纯文本节点。无属性时直接产出字符串，有属性才用 #text
  if (childElements.length === 0) {
    const text = element.textContent
    if (!hasAttributes) return text.trim() === '' ? '' : text
    const result = { ...attributes }
    if (text.trim() !== '') result['#text'] = text
    return result
  }

  // 有子元素：同名子元素出现多次时合并为数组
  const result = { ...attributes }
  for (const child of childElements) {
    const key = child.tagName
    const value = elementToValue(child)
    if (key in result) {
      result[key] = Array.isArray(result[key]) ? [...result[key], value] : [result[key], value]
    } else {
      result[key] = value
    }
  }

  // 混合内容里的直接文本（含 CDATA），纯空白缩进忽略
  const directText = Array.from(element.childNodes)
    .filter((node) => node.nodeType === 3 || node.nodeType === 4)
    .map((node) => node.nodeValue)
    .join('')
  if (directText.trim() !== '') result['#text'] = directText

  return result
}

// 解析 XML 文本为 JS 对象
export function parseXml(text) {
  const root = parseDocument(text).documentElement
  return { [root.tagName]: elementToValue(root) }
}

// 递归序列化：数组产出重复节点，null 产出空节点
function serializeNode(value, tag) {
  if (Array.isArray(value)) {
    return value.map((item) => serializeNode(item, tag)).join('')
  }
  if (value === null || typeof value !== 'object') {
    return `<${tag}>${value === null ? '' : escapeText(value)}</${tag}>`
  }

  let attributes = ''
  let text = ''
  let children = ''
  for (const [key, item] of Object.entries(value)) {
    if (key === '#text') text = escapeText(item)
    else if (key[0] === '@') attributes += ` ${key.slice(1)}="${escapeAttr(item)}"`
    else children += serializeNode(item, key)
  }
  return `<${tag}${attributes}>${text}${children}</${tag}>`
}

// 将 JS 对象序列化为 XML 文本
export function stringifyXml(data) {
  if (data === null || typeof data !== 'object') {
    throw new Error('顶层结构必须是对象')
  }

  // 恰好一个普通键时用它作根节点，否则包一层 <root>
  const keys = Object.keys(data).filter((key) => key !== '#text' && key[0] !== '@')
  const body =
    !Array.isArray(data) && keys.length === 1
      ? serializeNode(data[keys[0]], keys[0])
      : serializeNode(data, 'root')

  return XML_DECLARATION + '\n' + xmlFormat(body, FORMAT_OPTIONS)
}

// 格式化：先校验再美化。xml-formatter 会静默修复非法 XML，不能用它做校验
export function formatXml(text) {
  parseDocument(text)
  const body = text.replace(/^\s*<\?xml[^?]*\?>\s*/, '')
  return XML_DECLARATION + '\n' + xmlFormat(body, FORMAT_OPTIONS)
}
