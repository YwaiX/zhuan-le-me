import { ref, computed } from 'vue'
import { getTargetFormats, validateFileType } from '../config/convertRules.js'

export function useFileConvert(rules, typeOptions, typeExtensions, { strictType = true, convertFn = null } = {}) {
  // ---- 状态 ----
  const selectedType = ref('')
  const file = ref(null)
  const targetFormat = ref('')
  const converting = ref(false)
  const progress = ref(0)
  const resultFile = ref('')
  const resultBlob = ref(null)
  const convertError = ref('')

  // ---- 文件信息 ----
  const fileName = computed(() => file.value?.name || '')
  const fileExt = computed(() => {
    if (!file.value) return ''
    return file.value.name.split('.').pop()?.toLowerCase() || ''
  })
  const fileSize = computed(() => {
    if (!file.value) return ''
    const size = file.value.size
    if (size < 1024) return `${size} B`
    if (size < 1024 * 1024) return `${(size / 1024).toFixed(1)} KB`
    return `${(size / (1024 * 1024)).toFixed(1)} MB`
  })

  // ---- 目标格式列表 ----
  const availableTargets = computed(() => {
    if (!statusInfo.value.isTypeValid) return []
    return getTargetFormats(fileExt.value, rules)
  })

  // ---- 状态机判断 ----
  const statusInfo = computed(() => {
    // 转换异常
    if (convertError.value) {
      return {
        status: 'error',
        label: '处理失败',
        errorMessage: convertError.value,
        isTypeValid: true,
        canConvert: false
      }
    }

    // 正在转换中
    if (converting.value) {
      return {
        status: 'processing',
        label: '处理中',
        isTypeValid: true,
        canConvert: false
      }
    }

    // 转换完成
    if (resultFile.value) {
      return {
        status: 'done',
        label: '转换完成',
        isTypeValid: true,
        canConvert: false
      }
    }

    // 未上传文件
    if (!file.value) {
      return {
        status: 'idle',
        label: '等待上传文件',
        isTypeValid: true,
        canConvert: false
      }
    }

    // 文件类型校验（strictType 模式下才校验）
    if (strictType && selectedType.value) {
      const typeValid = validateFileType(file.value.name, selectedType.value, typeExtensions)
      if (!typeValid) {
        const expectedExts = typeExtensions[selectedType.value] || []
        return {
          status: 'type-error',
          label: '文件类型异常',
          errorMessage: `上传文件不是${expectedExts.join('/')}文件`,
          isTypeValid: false,
          canConvert: false
        }
      }
    }

    // 检查是否有可用的转换规则
    const targets = getTargetFormats(fileExt.value, rules)
    if (targets.length === 0) {
      return {
        status: 'type-error',
        label: '文件类型异常',
        errorMessage: '该文件格式不支持转换',
        isTypeValid: false,
        canConvert: false
      }
    }

    // 已选择目标格式
    if (targetFormat.value) {
      return {
        status: 'ready',
        label: '待处理',
        isTypeValid: true,
        canConvert: true
      }
    }

    return {
      status: 'ready',
      label: '待处理',
      isTypeValid: true,
      canConvert: false
    }
  })

  // ---- 方法 ----

  function selectType(type) {
    selectedType.value = type
    file.value = null
    targetFormat.value = ''
    progress.value = 0
    resultFile.value = ''
    resultBlob.value = null
    convertError.value = ''
  }

  function handleFileUpload(event) {
    const files = event.target.files
    if (files && files.length > 0) {
      setFile(files[0])
    }
  }

  function setFile(fileObj) {
    file.value = fileObj
    targetFormat.value = ''
    progress.value = 0
    resultFile.value = ''
    resultBlob.value = null
    convertError.value = ''
  }

  function clearFile() {
    file.value = null
    targetFormat.value = ''
    progress.value = 0
    resultFile.value = ''
    resultBlob.value = null
    convertError.value = ''
  }

  function selectTargetFormat(format) {
    targetFormat.value = format
    // 如果之前已完成转换，切换目标格式后重置结果以允许再次转换
    if (resultFile.value) {
      resultFile.value = ''
      resultBlob.value = null
      convertError.value = ''
    }
  }

  async function startConvert() {
    if (!statusInfo.value.canConvert) return

    converting.value = true
    progress.value = 0
    resultFile.value = ''
    resultBlob.value = null
    convertError.value = ''

    const baseName = file.value.name.replace(/\.[^.]+$/, '')
    const outputName = `${baseName}.${targetFormat.value}`

    try {
      if (convertFn) {
        resultBlob.value = await convertFn(file.value, targetFormat.value, (p) => {
          progress.value = p
        })
        if (!resultBlob.value) {
          throw new Error('该格式转换暂不支持')
        }
      } else {
        throw new Error('该工具暂不支持真实转换，请安装相关转换库')
      }

      resultFile.value = outputName
      new Notification('转换完成', { body: outputName })
    } catch (e) {
      convertError.value = e.message || '转换失败'
    }

    converting.value = false
  }

  function reset() {
    selectedType.value = ''
    file.value = null
    targetFormat.value = ''
    converting.value = false
    progress.value = 0
    resultFile.value = ''
    resultBlob.value = null
    convertError.value = ''
  }

  return {
    selectedType,
    file,
    targetFormat,
    converting,
    progress,
    resultFile,
    resultBlob,
    convertError,
    fileName,
    fileExt,
    fileSize,
    availableTargets,
    statusInfo,
    selectType,
    handleFileUpload,
    setFile,
    clearFile,
    selectTargetFormat,
    startConvert,
    reset
  }
}
