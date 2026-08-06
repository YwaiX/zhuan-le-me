import { app, shell, BrowserWindow, ipcMain, dialog } from 'electron'
import { join } from 'path'
import { writeFile, access, readFile, unlink } from 'fs/promises'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { randomUUID } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.electron')

  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // 获取当前窗口的辅助函数
  const getWin = (event) => BrowserWindow.fromWebContents(event.sender)

  // 窗口移动 IPC：接收渲染进程发来的坐标差值，动态设置窗口位置
  ipcMain.on('window-move', (event, { deltaX, deltaY }) => {
    const win = getWin(event)
    if (!win) return
    const [x, y] = win.getPosition()
    win.setPosition(x + deltaX, y + deltaY)
  })

  // 窗口最大化/还原切换，返回操作后的最大化状态
  ipcMain.handle('window-toggle-maximize', (event) => {
    const win = getWin(event)
    if (!win) return false
    if (win.isMaximized()) {
      win.unmaximize()
      return false
    } else {
      win.maximize()
      return true
    }
  })

  // 窗口最小化
  ipcMain.on('window-minimize', (event) => {
    const win = getWin(event)
    if (win) win.minimize()
  })

  // 窗口关闭（通过 IPC 触发，方便后续扩展关闭前的确认逻辑）
  ipcMain.on('window-close', (event) => {
    const win = getWin(event)
    if (win) win.close()
  })

  // 保存文件对话框
  ipcMain.handle('show-save-dialog', async (event, defaultName) => {
    const win = getWin(event)
    const result = await dialog.showSaveDialog(win, {
      defaultPath: defaultName
    })
    return result.canceled ? null : result.filePath
  })

  // 写入文件到磁盘
  ipcMain.handle('write-file', async (_event, filePath, data) => {
    await writeFile(filePath, Buffer.from(data))
  })

  // 检测文件/程序是否存在
  ipcMain.handle('path-exists', async (_event, filePath) => {
    try {
      await access(filePath)
      return true
    } catch {
      return false
    }
  })

  // 获取项目内 LibreOffice 路径
  const getSofficePath = () => {
    if (app.isPackaged) {
      return join(process.resourcesPath, 'libreoffice', 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.exe')
    }
    return join(__dirname, '../..', 'libreoffice', 'LibreOfficePortable', 'App', 'libreoffice', 'program', 'soffice.exe')
  }

  ipcMain.handle('get-soffice-path', () => getSofficePath())

  // LibreOffice 转换：接收文件数据，写入临时文件，调用 soffice 转换，返回结果
  ipcMain.handle('libreoffice-convert', async (_event, { data, sourceExt, targetExt }) => {
    const sofficePath = getSofficePath()
    const id = randomUUID()
    const tmpDir = tmpdir()
    const inputPath = join(tmpDir, `${id}.${sourceExt}`)
    const outputPath = join(tmpDir, `${id}.${targetExt}`)

    await writeFile(inputPath, Buffer.from(data))

    // PDF 作为源文件时需要指定正确的导入过滤器
    const infilterMap = { pdf_docx: 'writer_pdf_import', pdf_pptx: 'impress_pdf_import' }
    const infilter = infilterMap[`${sourceExt}_${targetExt}`]
    const args = ['--headless']
    if (infilter) args.push('--infilter=' + infilter)
    args.push('--convert-to', targetExt, '--outdir', tmpDir, inputPath)

    // LibreOffice 安装根目录（program/ 上两级），用于 cwd，保证 LO 能找到 share/ 等资源
    const loRoot = join(sofficePath, '..', '..')

    await new Promise((resolve, reject) => {
      execFile(sofficePath, args, {
        cwd: loRoot,
        env: {
          ...process.env,
          ...(process.platform === 'win32' ? { SAL_USE_VCLPLUGIN: 'gen' } : {})
        }
      }, (error, stdout, stderr) => {
        if (error) {
          const detail = stderr ? `\nstderr: ${stderr.slice(0, 500)}` : ''
          reject(new Error(`LibreOffice 转换失败: ${error.message}${detail}`))
          return
        }
        resolve()
      })
    })

    // 验证输出文件是否生成
    try {
      await access(outputPath)
    } catch {
      throw new Error(
        `LibreOffice 转换后未生成输出文件。\n` +
        `期望路径: ${outputPath}\n` +
        `源格式: ${sourceExt} → 目标格式: ${targetExt}`
      )
    }

    const output = await readFile(outputPath)

    await unlink(inputPath).catch(() => {})
    await unlink(outputPath).catch(() => {})

    return Array.from(new Uint8Array(output))
  })

  createWindow()

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
