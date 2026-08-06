import { jsPDF } from 'jspdf'

// ====================================================================
// 内部工具函数（不导出，仅供本文件内 1v1 转换方法使用）
// ====================================================================

const MIME = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  gif: 'image/gif',
  bmp: 'image/bmp'
}

/** 加载普通位图文件 → { img, url, w, h } */
function loadRaster(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => resolve({ img, url, w: img.naturalWidth, h: img.naturalHeight })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('图片加载失败'))
    }
    img.src = url
  })
}

/** 从 SVG 文本解析 viewBox / width / height */
function parseSvgSize(text) {
  const parser = new DOMParser()
  const doc = parser.parseFromString(text, 'image/svg+xml')
  const svg = doc.querySelector('svg')
  if (!svg) return { w: 0, h: 0 }
  let w = 0
  let h = 0

  const vb = svg.getAttribute('viewBox')
  if (vb) {
    const parts = vb.trim().split(/[\s,]+/)
    if (parts.length === 4) {
      w = parseFloat(parts[2])
      h = parseFloat(parts[3])
    }
  }

  if (!w || !h) {
    const wAttr = svg.getAttribute('width')
    const hAttr = svg.getAttribute('height')
    if (wAttr && !wAttr.includes('%')) w = parseFloat(wAttr)
    if (hAttr && !hAttr.includes('%')) h = parseFloat(hAttr)
  }

  return { w: Math.round(w), h: Math.round(h) }
}

/** 加载 SVG 文件 → { img, url, w, h }，宽高从 viewBox 解析，默认 3x 倍率 */
async function loadSvg(file, scale = 3) {
  const text = await file.text()
  const size = parseSvgSize(text)
  const blob = new Blob([text], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve({ img, url, w: (size.w || 800) * scale, h: (size.h || 600) * scale })
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('SVG 加载失败'))
    }
    img.src = url
  })
}

/** 将 img 绘制到 Canvas 上（1:1 原始尺寸） */
function drawToCanvas(img, w, h, whiteBg = false) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (whiteBg) {
    ctx.fillStyle = '#FFFFFF'
    ctx.fillRect(0, 0, w, h)
  }
  ctx.drawImage(img, 0, 0, w, h)
  return canvas
}

/** Canvas → Blob */
function canvasToBlob(canvas, mime, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), mime, quality)
  })
}

/** Canvas → PDF Blob */
function canvasToPdfBlob(canvas, w, h) {
  const pdf = new jsPDF({ unit: 'px', format: [w, h] })
  pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, w, h)
  return pdf.output('blob')
}

/** Canvas → ICO Blob（PNG 数据嵌入 ICO 容器，单图标） */
async function canvasToIcoBlob(canvas) {
  const pngBlob = await canvasToBlob(canvas, MIME.png)
  const pngData = new Uint8Array(await pngBlob.arrayBuffer())

  const w = Math.min(canvas.width, 256)
  const h = Math.min(canvas.height, 256)

  const headerSize = 6
  const dirSize = 16
  const imageOffset = headerSize + dirSize

  const buffer = new ArrayBuffer(imageOffset + pngData.length)
  const view = new DataView(buffer)

  // ICO 文件头
  view.setUint16(0, 0, true)                    // 保留字段
  view.setUint16(2, 1, true)                    // 类型: 1=ICO
  view.setUint16(4, 1, true)                    // 图标数量

  // 目录条目
  view.setUint8(6, w >= 256 ? 0 : w)            // 宽度（0 表示 256）
  view.setUint8(7, h >= 256 ? 0 : h)            // 高度
  view.setUint8(8, 0)                            // 调色板颜色数
  view.setUint8(9, 0)                            // 保留
  view.setUint16(10, 1, true)                    // 色彩平面数
  view.setUint16(12, 32, true)                   // 位深度
  view.setUint32(14, pngData.length, true)       // 图像数据大小
  view.setUint32(18, imageOffset, true)          // 图像数据偏移

  // 拷贝 PNG 数据
  const out = new Uint8Array(buffer)
  out.set(pngData, imageOffset)

  return new Blob([buffer], { type: 'image/x-icon' })
}

/** 位图嵌入 SVG 包装器（非矢量化，生成合法的 .svg 文件） */
function rasterToSvgBlob(img, w, h) {
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, w, h)
  const dataUrl = canvas.toDataURL('image/png')
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">\n  <image href="${dataUrl}" width="${w}" height="${h}"/>\n</svg>`
  return new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
}

// ====================================================================
// 1v1 转换方法（公有的，每一个方法独立维护）
// ====================================================================

// ---------- JPG → * ----------

export async function jpgToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function jpgToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function jpgToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function jpgToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function jpgToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function jpgToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    return rasterToSvgBlob(img, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function jpgToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- PNG → * ----------

export async function pngToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function pngToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function pngToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function pngToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function pngToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function pngToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    return rasterToSvgBlob(img, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function pngToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- WebP → * ----------

export async function webpToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function webpToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function webpToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function webpToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function webpToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function webpToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function webpToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- GIF → * ----------

export async function gifToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function gifToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function gifToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function gifToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function gifToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function gifToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function gifToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- BMP → * ----------

export async function bmpToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function bmpToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function bmpToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function bmpToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function bmpToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function bmpToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function bmpToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- HEIC → * ----------

export async function heicToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function heicToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function heicToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function heicToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function heicToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function heicToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function heicToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function heicToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- AVIF → * ----------

export async function avifToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function avifToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function avifToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function avifToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function avifToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function avifToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function avifToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function avifToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- TIFF → * ----------

export async function tiffToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function tiffToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function tiffToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function tiffToPdf(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function tiffToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function tiffToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function tiffToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function tiffToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- SVG → * ----------

export async function svgToPng(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToJpg(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToWebp(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToPdf(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return canvasToPdfBlob(canvas, w, h)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToGif(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToBmp(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function svgToIco(file) {
  const { img, url, w, h } = await loadSvg(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ---------- ICO → * ----------

export async function icoToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function icoToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function icoToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function icoToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function icoToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function icoToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

// ---------- APNG → * ----------

export async function apngToPng(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.png)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function apngToGif(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.gif)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function apngToWebp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.webp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function apngToJpg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h, true)
    return await canvasToBlob(canvas, MIME.jpeg, 0.92)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function apngToBmp(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, w, h)
    return await canvasToBlob(canvas, MIME.bmp)
  } finally {
    URL.revokeObjectURL(url)
  }
}

export async function apngToSvg(file) {
  const { img, url, w, h } = await loadRaster(file)
  try { return rasterToSvgBlob(img, w, h) } finally { URL.revokeObjectURL(url) }
}

export async function apngToIco(file) {
  const { img, url, w, h } = await loadRaster(file)
  try {
    const canvas = drawToCanvas(img, Math.min(w, 256), Math.min(h, 256))
    return await canvasToIcoBlob(canvas)
  } finally {
    URL.revokeObjectURL(url)
  }
}

// ====================================================================
// 转换器映射表：`{ext}_{target}` → 1v1 方法
// ====================================================================

export const IMAGE_CONVERTERS = {
  jpg_png: jpgToPng, jpg_webp: jpgToWebp, jpg_gif: jpgToGif, jpg_bmp: jpgToBmp, jpg_ico: jpgToIco, jpg_pdf: jpgToPdf, jpg_svg: jpgToSvg,
  jpeg_png: jpgToPng, jpeg_webp: jpgToWebp, jpeg_gif: jpgToGif, jpeg_bmp: jpgToBmp, jpeg_ico: jpgToIco, jpeg_pdf: jpgToPdf, jpeg_svg: jpgToSvg,
  png_jpg: pngToJpg, png_webp: pngToWebp, png_gif: pngToGif, png_bmp: pngToBmp, png_ico: pngToIco, png_pdf: pngToPdf, png_svg: pngToSvg,
  webp_jpg: webpToJpg, webp_png: webpToPng, webp_gif: webpToGif, webp_bmp: webpToBmp, webp_ico: webpToIco, webp_pdf: webpToPdf, webp_svg: webpToSvg,
  gif_jpg: gifToJpg, gif_png: gifToPng, gif_webp: gifToWebp, gif_bmp: gifToBmp, gif_ico: gifToIco, gif_pdf: gifToPdf, gif_svg: gifToSvg,
  bmp_jpg: bmpToJpg, bmp_png: bmpToPng, bmp_webp: bmpToWebp, bmp_gif: bmpToGif, bmp_ico: bmpToIco, bmp_pdf: bmpToPdf, bmp_svg: bmpToSvg,
  heic_jpg: heicToJpg, heic_png: heicToPng, heic_webp: heicToWebp, heic_gif: heicToGif, heic_bmp: heicToBmp, heic_ico: heicToIco, heic_pdf: heicToPdf, heic_svg: heicToSvg,
  avif_jpg: avifToJpg, avif_png: avifToPng, avif_webp: avifToWebp, avif_gif: avifToGif, avif_bmp: avifToBmp, avif_ico: avifToIco, avif_pdf: avifToPdf, avif_svg: avifToSvg,
  tiff_jpg: tiffToJpg, tiff_png: tiffToPng, tiff_webp: tiffToWebp, tiff_gif: tiffToGif, tiff_bmp: tiffToBmp, tiff_ico: tiffToIco, tiff_pdf: tiffToPdf, tiff_svg: tiffToSvg,
  tif_jpg: tiffToJpg, tif_png: tiffToPng, tif_webp: tiffToWebp, tif_gif: tiffToGif, tif_bmp: tiffToBmp, tif_ico: tiffToIco, tif_pdf: tiffToPdf, tif_svg: tiffToSvg,
  svg_jpg: svgToJpg, svg_png: svgToPng, svg_webp: svgToWebp, svg_gif: svgToGif, svg_bmp: svgToBmp, svg_ico: svgToIco, svg_pdf: svgToPdf,
  ico_jpg: icoToJpg, ico_png: icoToPng, ico_webp: icoToWebp, ico_gif: icoToGif, ico_bmp: icoToBmp, ico_svg: icoToSvg,
  apng_jpg: apngToJpg, apng_png: apngToPng, apng_webp: apngToWebp, apng_gif: apngToGif, apng_bmp: apngToBmp, apng_ico: apngToIco, apng_svg: apngToSvg
}

/**
 * 调度函数：根据源扩展名和目标格式找到对应的 1v1 转换方法
 * @param {File} file - 原始文件
 * @param {string} targetFmt - 目标格式
 * @returns {Promise<Blob>}
 */
export function dispatchConvert(file, targetFmt) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const key = `${ext}_${targetFmt}`
  const converter = IMAGE_CONVERTERS[key]
  if (!converter) {
    throw new Error(`${ext} → ${targetFmt} 暂不支持`)
  }
  return converter(file)
}
