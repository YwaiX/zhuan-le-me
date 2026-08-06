import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

// ====================================================================
// 内部工具函数
// ====================================================================

/** 加载 PDF 并渲染第 1 页到 Canvas */
async function renderFirstPage(file) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)
  const viewport = page.getViewport({ scale: 2 })

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height
  const ctx = canvas.getContext('2d')

  await page.render({ canvasContext: ctx, viewport }).promise
  return canvas
}

/** Canvas → Blob */
function canvasToBlob(canvas, mime, quality = 0.92) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('导出失败'))), mime, quality)
  })
}

// ====================================================================
// 1v1 转换方法
// ====================================================================

export async function pdfToJpg(file) {
  const canvas = await renderFirstPage(file)
  return await canvasToBlob(canvas, 'image/jpeg', 0.92)
}

export async function pdfToPng(file) {
  const canvas = await renderFirstPage(file)
  return await canvasToBlob(canvas, 'image/png')
}

// ===== PDF → Office（通过 LibreOffice，走 IPC 到主进程） =====

async function pdfToOffice(file, targetExt) {
  const arrayBuffer = await file.arrayBuffer()
  const data = Array.from(new Uint8Array(arrayBuffer))
  const ext = file.name.split('.').pop()?.toLowerCase() || 'pdf'
  const result = await window.api.libreOfficeConvert(data, ext, targetExt)
  return new Blob([new Uint8Array(result)])
}

export function pdfToDocx(file) {
  return pdfToOffice(file, 'docx')
}

export function pdfToPptx(file) {
  return pdfToOffice(file, 'pptx')
}

// ====================================================================
// 转换器映射表
// ====================================================================

export const PDF_CONVERTERS = {
  pdf_jpg: pdfToJpg,
  pdf_png: pdfToPng,
  pdf_docx: pdfToDocx,
  pdf_pptx: pdfToPptx
}

/**
 * 调度函数
 * @param {File} file - PDF 文件
 * @param {string} targetFmt - 目标格式 (jpg | png)
 */
export function dispatchPdfConvert(file, targetFmt) {
  const ext = file.name.split('.').pop()?.toLowerCase() || ''
  const key = `${ext}_${targetFmt}`
  const converter = PDF_CONVERTERS[key]
  if (!converter) {
    throw new Error(`${ext} → ${targetFmt} 暂不支持`)
  }
  return converter(file)
}
