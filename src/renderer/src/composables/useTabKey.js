export function useTabKey() {
  function onTabKey(e) {
    if (e.key !== 'Tab') return
    e.preventDefault()

    const el = e.target
    const start = el.selectionStart
    const end = el.selectionEnd
    const value = el.value

    if (e.shiftKey) {
      // Shift+Tab：减少缩进
      const lineStart = value.lastIndexOf('\n', start - 1) + 1
      const before = value.substring(lineStart, start)
      const match = before.match(/^ {1,2}/)
      if (match) {
        const remove = match[0].length
        el.value = value.substring(0, start - remove) + value.substring(end)
        el.selectionStart = el.selectionEnd = start - remove
        el.dispatchEvent(new Event('input', { bubbles: true }))
      }
      return
    }

    const indent = '  '
    el.value = value.substring(0, start) + indent + value.substring(end)
    el.selectionStart = el.selectionEnd = start + indent.length
    el.dispatchEvent(new Event('input', { bubbles: true }))
  }

  return { onTabKey }
}
