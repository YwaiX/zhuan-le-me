// Properties 格式与 JS 对象互转
//
// 层级约定：键按 `.` 分层，`key[N]` 表示数组下标
//   server.port=8080      → { server: { port: 8080 } }
//   users[0]=Tom          → { users: ['Tom'] }
//
// 已知限制：键名本身含 `.` 时会被当作层级分隔符（无法表达）

// 反转义：\\ \n \r \t \f \: \= \uXXXX
function unescape(text) {
  return text.replace(/\\(u[0-9a-fA-F]{4}|[\s\S])/g, (_m, seq) => {
    if (seq[0] === 'u') return String.fromCharCode(parseInt(seq.slice(1), 16))
    const map = { n: '\n', r: '\r', t: '\t', f: '\f' }
    return map[seq] || seq
  })
}

// 转义控制字符与反斜杠；extra 里的字符额外转义（键需要转义分隔符）
function escape(text, extra = '') {
  let result = String(text)
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/\r/g, '\\r')
    .replace(/\t/g, '\\t')
    .replace(/\f/g, '\\f')
  for (const ch of extra) {
    result = result.split(ch).join('\\' + ch)
  }
  return result
}

// 在第一个未转义的 = 或 : 处切分，未找到分隔符返回 null
function splitEntry(line) {
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\') {
      i++
      continue
    }
    if (ch === '=' || ch === ':') {
      return [line.slice(0, i), line.slice(i + 1)]
    }
  }
  return null
}

// 值类型推断：空值 → 空字符串，布尔 → 布尔，纯数值 → 数字，其余 → 字符串
// 注意 127.0.0.1 含两个小数点，不匹配数值正则，保持字符串
function inferValue(raw) {
  const value = raw.trim()
  if (value === '') return ''
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^[+-]?(\d+(\.\d*)?|\.\d+)([eE][+-]?\d+)?$/.test(value)) {
    const num = Number(value)
    if (Number.isFinite(num)) return num
  }
  return value
}

// 键路径拆成 token 序列，数字 token 表示数组下标
// 'a.b[0].c' → ['a', 'b', 0, 'c']
function parseKeyPath(key) {
  const tokens = []
  for (const segment of key.split('.')) {
    const matched = segment.match(/^(.*?)((?:\[\d+\])+)$/)
    if (matched && matched[1]) {
      tokens.push(matched[1])
      for (const index of matched[2].match(/\d+/g)) tokens.push(Number(index))
    } else {
      tokens.push(segment)
    }
  }
  return tokens
}

// 按 token 序列写入，中间层不是容器时替换为容器（标量让位给对象/数组）
function setByTokens(root, tokens, value) {
  let current = root
  for (let i = 0; i < tokens.length - 1; i++) {
    const key = tokens[i]
    if (current[key] === null || typeof current[key] !== 'object') {
      current[key] = typeof tokens[i + 1] === 'number' ? [] : {}
    }
    current = current[key]
  }
  const last = tokens[tokens.length - 1]
  // 数组下标跳跃时补 null，避免产生空洞
  if (Array.isArray(current) && typeof last === 'number') {
    for (let i = current.length; i < last; i++) current[i] = null
  }
  current[last] = value
}

// 解析 Properties 文本为 JS 对象
export function parseProperties(text) {
  const root = {}
  let matched = 0

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#') || line.startsWith('!')) continue

    const entry = splitEntry(line)
    if (!entry) continue

    const key = unescape(entry[0]).trim()
    if (!key) continue

    setByTokens(root, parseKeyPath(key), inferValue(unescape(entry[1])))
    matched++
  }

  if (matched === 0) {
    throw new Error('未找到有效的属性行')
  }
  return root
}

// 提取整行注释，挂到其后的第一个顶层键上（供 Properties → YML 保留注释）
export function parsePropertiesComments(text) {
  const comments = {}
  let pending = []

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#') || line.startsWith('!')) {
      pending.push(' ' + line.slice(1).trim())
      continue
    }
    if (pending.length > 0) {
      const entry = splitEntry(line)
      if (entry) {
        const topKey = unescape(entry[0]).trim().split('.')[0].replace(/\[\d+\]$/, '')
        if (topKey && !comments[topKey]) comments[topKey] = pending.join('\n')
      }
      pending = []
    }
  }
  return comments
}

// 递归扁平化，空对象与空数组不产出行（Properties 无法表达空容器）
function flatten(value, prefix, lines) {
  if (Array.isArray(value)) {
    value.forEach((item, index) => flatten(item, `${prefix}[${index}]`, lines))
    return
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      const escapedKey = escape(key, '=:')
      flatten(item, prefix ? `${prefix}.${escapedKey}` : escapedKey, lines)
    }
    return
  }
  // null 输出为空值；值中的 = 与 : 无需转义，切分只认第一个分隔符
  lines.push(`${prefix}=${value === null ? '' : escape(value)}`)
}

// 将 JS 对象序列化为 Properties 文本
export function stringifyProperties(data) {
  if (data === null || typeof data !== 'object') {
    throw new Error('顶层结构必须是对象或数组')
  }
  const lines = []
  flatten(data, '', lines)
  return lines.join('\n') + '\n'
}

// 格式化：去除行尾空白并压缩连续空行
export function formatProperties(text) {
  return (
    text
      .replace(/\r\n/g, '\n')
      .split('\n')
      .map((line) => line.trimEnd())
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim() + '\n'
  )
}
