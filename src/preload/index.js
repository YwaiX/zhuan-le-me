import { contextBridge, ipcRenderer } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'

// 自定义 API：暴露给渲染进程
const api = {
  // 窗口移动：发送坐标差值到主进程
  windowMove: (deltaX, deltaY) => {
    ipcRenderer.send('window-move', { deltaX, deltaY })
  },
  // 窗口最小化
  windowMinimize: () => {
    ipcRenderer.send('window-minimize')
  },
  // 切换最大化/还原，返回操作后的最大化状态
  windowToggleMaximize: () => {
    return ipcRenderer.invoke('window-toggle-maximize')
  },
  // 窗口关闭
  windowClose: () => {
    ipcRenderer.send('window-close')
  },
  // 保存文件对话框，返回用户选择的路径（取消则返回 null）
  showSaveDialog: (defaultName) => {
    return ipcRenderer.invoke('show-save-dialog', defaultName)
  },
  // 将数据写入磁盘
  writeFile: (filePath, data) => {
    return ipcRenderer.invoke('write-file', filePath, data)
  },
  // 检测文件/程序是否存在
  pathExists: (filePath) => {
    return ipcRenderer.invoke('path-exists', filePath)
  },
  // 复制文本到剪贴板（错误信息复制用）
  copyText: (text) => {
    return ipcRenderer.invoke('copy-text', text)
  },
  // 获取项目内 LibreOffice 的 soffice.exe 路径
  getSofficePath: () => {
    return ipcRenderer.invoke('get-soffice-path')
  },
  // 通过 LibreOffice 转换文件，返回转换后的字节数组
  libreOfficeConvert: (data, sourceExt, targetExt) => {
    return ipcRenderer.invoke('libreoffice-convert', { data, sourceExt, targetExt })
  },
  // 生成密钥对
  generateKeyPair: (options) => {
    return ipcRenderer.invoke('generate-key-pair', options)
  },
  // 生成随机密钥
  generateRandomKeys: (params) => {
    return ipcRenderer.invoke('generate-random-keys', params)
  },
  // JWT 操作
  jwtOperate: (params) => {
    return ipcRenderer.invoke('jwt-operate', params)
  }
}

if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  window.electron = electronAPI
  window.api = api
}
