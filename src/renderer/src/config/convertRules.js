// 文件转换工具 — 转换规则配置
// 每种源格式对应可转换的目标格式数组

// Office 格式转换规则
export const officeRules = {
  doc: ['pdf'],
  docx: ['pdf'],
  xls: ['pdf'],
  xlsx: ['pdf'],
  ppt: ['pdf'],
  pptx: ['pdf']
}

// Office 源格式类型列表（用户可选择）
export const officeTypeOptions = [
  { label: 'Word', value: 'word' },
  { label: 'Excel', value: 'excel' },
  { label: 'PowerPoint', value: 'powerpoint' }
]

// 每种 Office 类型对应的文件扩展名
export const officeTypeExtensions = {
  word: ['doc', 'docx'],
  excel: ['xls', 'xlsx'],
  powerpoint: ['ppt', 'pptx']
}

// 图片格式转换规则 — 完整双向转换矩阵
// 排除项：Canvas 无法编码为 HEIC/AVIF/TIFF/SVG/APNG 作为目标
//         ICO 由 PNG 数据嵌入 ICO 容器实现，通用位图格式均可转换
//         无法矢量化为 SVG
//         动画格式(GIF/APNG)转出只保留首帧
export const imageRules = {
  jpg: ['png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  jpeg: ['png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  png: ['jpg', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  webp: ['jpg', 'png', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  gif: ['jpg', 'png', 'webp', 'bmp', 'ico', 'pdf', 'svg'],
  bmp: ['jpg', 'png', 'webp', 'gif', 'ico', 'pdf', 'svg'],
  heic: ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  avif: ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  tiff: ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  tif: ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg'],
  svg: ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'pdf'],
  ico: ['jpg', 'png', 'webp', 'gif', 'bmp', 'pdf', 'svg'],
  apng: ['jpg', 'png', 'webp', 'gif', 'bmp', 'ico', 'pdf', 'svg']
}

// 图片源格式类型列表（第12节全部类型）
export const imageTypeOptions = [
  { label: 'JPG', value: 'jpg' },
  { label: 'PNG', value: 'png' },
  { label: 'WebP', value: 'webp' },
  { label: 'GIF', value: 'gif' },
  { label: 'BMP', value: 'bmp' },
  { label: 'HEIC', value: 'heic' },
  { label: 'AVIF', value: 'avif' },
  { label: 'TIFF', value: 'tiff' },
  { label: 'SVG', value: 'svg' },
  { label: 'ICO', value: 'ico' },
  { label: 'APNG', value: 'apng' }
]

// 图片格式对应的扩展名
export const imageTypeExtensions = {
  jpg: ['jpg', 'jpeg'],
  png: ['png'],
  webp: ['webp'],
  gif: ['gif'],
  bmp: ['bmp'],
  heic: ['heic'],
  avif: ['avif'],
  tiff: ['tiff', 'tif'],
  svg: ['svg'],
  ico: ['ico'],
  apng: ['apng']
}

// PDF 格式转换规则
export const pdfRules = {
  pdf: ['jpg', 'png', 'docx', 'pptx']
}

// PDF 源格式类型列表（PDF 工具固定为 PDF）
export const pdfTypeOptions = [
  { label: 'PDF', value: 'pdf' }
]

// PDF 类型对应的扩展名
export const pdfTypeExtensions = {
  pdf: ['pdf']
}

// ========== 工具函数 ==========

// 根据源格式扩展名获取可转换的目标格式
export function getTargetFormats(sourceExt, rules) {
  return rules[sourceExt] || []
}

// 校验文件扩展名是否匹配所选类型
export function validateFileType(fileName, selectedType, typeExtensions) {
  const ext = fileName.split('.').pop()?.toLowerCase()
  if (!ext) return false
  const allowedExts = typeExtensions[selectedType]
  return allowedExts ? allowedExts.includes(ext) : false
}
