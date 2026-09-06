import { app, shell, BrowserWindow, ipcMain, dialog, clipboard } from 'electron'
import { join } from 'path'
import { writeFile, access, readFile, unlink, mkdir, rm } from 'fs/promises'
import { execFile } from 'child_process'
import { tmpdir } from 'os'
import { randomUUID, generateKeyPairSync, randomBytes, createHash, createHmac, createSign, createVerify } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
// ============ 启动性能打点（PERF_DEBUG=1 开启） ============
const PERF_DEBUG = process.env.PERF_DEBUG === '1'
const perfT0 = Date.now()
function perfLog(label) {
  if (PERF_DEBUG) console.log(`[perf][main] ${label}: ${Date.now() - perfT0}ms`)
}
perfLog('module-load')

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
    perfLog('window-ready-to-show')
    mainWindow.show()
    perfLog('window-shown')
  })

  mainWindow.webContents.on('did-finish-load', () => {
    perfLog('page-did-finish-load')
    if (PERF_DEBUG) {
      // 测量模式：等首帧渲染稳定后采集 DOM/样式探针与截图并退出，便于无人值守的冷启动采集与视觉冒烟
      setTimeout(async () => {
        try {
          const probe = await mainWindow.webContents.executeJavaScript(`(() => {
            const menuItem = document.querySelector('.el-menu-item')
            const input = document.querySelector('.el-input__inner')
            return JSON.stringify({
              menuItems: document.querySelectorAll('.el-menu-item').length,
              subMenus: document.querySelectorAll('.el-sub-menu').length,
              empty: document.querySelectorAll('.el-empty').length,
              inputs: document.querySelectorAll('.el-input').length,
              menuItemColor: menuItem ? getComputedStyle(menuItem).color : null,
              menuItemFont: menuItem ? getComputedStyle(menuItem).fontSize : null,
              inputBorder: input ? getComputedStyle(input).borderColor : null,
              cssSheets: document.styleSheets.length
            })
          })()`)
          console.log(`[perf][main] dom-probe: ${probe}`)
          const image = await mainWindow.webContents.capturePage()
          const shotPath = join(app.getPath('temp'), 'zhuanleme_perf.png')
          await writeFile(shotPath, image.toPNG())
          console.log(`[perf][main] screenshot saved: ${shotPath}`)
        } catch (e) {
          console.log(`[perf][main] probe/screenshot failed: ${e.message}`)
        }
        app.quit()
      }, 1200)
    }
  })

  if (PERF_DEBUG) {
    // 转发渲染进程的 [perf] 打点到主进程 stdout，便于汇总时间线
    mainWindow.webContents.on('console-message', (_event, _level, message) => {
      if (message) console.log(`[renderer] ${message}`)
    })
  }

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
  perfLog('app-ready')

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

  // 复制文本到剪贴板（错误信息复制用）
  ipcMain.handle('copy-text', (_event, text) => {
    clipboard.writeText(String(text ?? ''))
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
  // 串行执行：并发调用会争抢同一用户配置锁，导致后续转换静默失败（未生成输出文件）
  let loConvertQueue = Promise.resolve()

  ipcMain.handle('libreoffice-convert', (_event, payload) => {
    const task = loConvertQueue.then(() => runLibreOfficeConvert(payload))
    loConvertQueue = task.catch(() => {})
    return task
  })

  async function runLibreOfficeConvert({ data, sourceExt, targetExt }) {
    const sofficePath = getSofficePath()
    const id = randomUUID()
    const tmpDir = tmpdir()
    const inputPath = join(tmpDir, `${id}.${sourceExt}`)
    const outputPath = join(tmpDir, `${id}.${targetExt}`)
    // 独立的用户配置目录：避免复用打包内嵌的便携 profile（只读/残留状态会导致转换静默失败）
    const profilePath = join(tmpDir, `${id}_profile`)
    await mkdir(profilePath, { recursive: true })

    await writeFile(inputPath, Buffer.from(data))

    // PDF 作为源文件时需要指定正确的导入过滤器
    const infilterMap = { pdf_docx: 'writer_pdf_import', pdf_pptx: 'impress_pdf_import' }
    const infilter = infilterMap[`${sourceExt}_${targetExt}`]
    const args = ['--headless', `-env:UserInstallation=file:///${encodeURI(profilePath.replace(/\\/g, '/'))}`]
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
    await rm(profilePath, { recursive: true, force: true }).catch(() => {})

    return Array.from(new Uint8Array(output))
  }

  // ==================== 密钥对生成 IPC ====================

  // ASN.1 DER 编码辅助函数
  function encodeLength(len) {
    if (len < 128) return Buffer.from([len])
    const bytes = []
    let l = len
    while (l > 0) {
      bytes.unshift(l & 0xff)
      l >>>= 8
    }
    return Buffer.from([0x80 | bytes.length, ...bytes])
  }

  function encodeOID(oid) {
    const parts = oid.split('.').map(Number)
    const result = [40 * parts[0] + parts[1]]
    for (let i = 2; i < parts.length; i++) {
      let val = parts[i]
      const bytes = []
      if (val === 0) {
        bytes.push(0)
      } else {
        while (val > 0) {
          bytes.unshift(val & 0x7f)
          val >>>= 7
        }
      }
      for (let j = 0; j < bytes.length - 1; j++) {
        bytes[j] |= 0x80
      }
      result.push(...bytes)
    }
    return Buffer.from([0x06, result.length, ...result])
  }

  function encodeOctetString(buf) {
    return Buffer.concat([Buffer.from([0x04]), encodeLength(buf.length), buf])
  }

  function encodeBitString(buf) {
    return Buffer.concat([Buffer.from([0x03]), encodeLength(buf.length + 1), Buffer.from([0x00]), buf])
  }

  function encodeInteger(num) {
    const hex = num.toString(16)
    const buf = Buffer.from(hex.length % 2 ? '0' + hex : hex, 'hex')
    return Buffer.concat([Buffer.from([0x02]), encodeLength(buf.length), buf])
  }

  function encodeSequence(items) {
    const content = Buffer.concat(items)
    return Buffer.concat([Buffer.from([0x30]), encodeLength(content.length), content])
  }

  function encodeExplicit(tag, content) {
    return Buffer.concat([Buffer.from([0xa0 | tag]), encodeLength(content.length), content])
  }

  // 将 SM2 原始密钥转换为 PEM 格式
  function sm2ToPEM(publicKeyHex, privateKeyHex) {
    const SM2_OID = '1.2.156.10197.1.301'
    const EC_PUBLIC_KEY_OID = '1.2.840.10045.2.1'

    // 公钥点: 04 || x || y (各64 hex chars = 32 bytes)
    const pubKeyBytes = Buffer.from('04' + publicKeyHex, 'hex')

    // 公钥 X.509 SubjectPublicKeyInfo
    const algoId = encodeSequence([
      encodeOID(EC_PUBLIC_KEY_OID),
      encodeOID(SM2_OID)
    ])
    const pubKeyBS = encodeBitString(pubKeyBytes)
    const spki = encodeSequence([algoId, pubKeyBS])
    const publicKeyPem = '-----BEGIN PUBLIC KEY-----\n' +
      spki.toString('base64').replace(/(.{64})/g, '$1\n') +
      (spki.length % 64 ? '\n' : '') +
      '-----END PUBLIC KEY-----\n'

    // 私钥 SEC1 ECPrivateKey
    const privKeyBytes = Buffer.from(privateKeyHex, 'hex')
    const ecPrivKey = encodeSequence([
      encodeInteger(1),
      encodeOctetString(privKeyBytes),
      encodeExplicit(0, encodeOID(SM2_OID)),
      encodeExplicit(1, encodeBitString(pubKeyBytes))
    ])
    const privateKeyPem = '-----BEGIN EC PRIVATE KEY-----\n' +
      ecPrivKey.toString('base64').replace(/(.{64})/g, '$1\n') +
      (ecPrivKey.length % 64 ? '\n' : '') +
      '-----END EC PRIVATE KEY-----\n'

    return { publicKeyPem, privateKeyPem }
  }

  ipcMain.handle('generate-key-pair', async (_event, options) => {
    const { algorithm, keyLength, curve, format: outputFormat } = options

    try {
      if (algorithm === 'SM2') {
        // 使用 sm-crypto 生成 SM2 密钥对（按需动态加载，避免每次启动解析执行该库）
        const { sm2 } = await import('sm-crypto')
        const keypair = sm2.generateKeyPairHex()

        if (outputFormat === 'PEM') {
          const pem = sm2ToPEM(keypair.publicKey, keypair.privateKey)
          return { publicKey: pem.publicKeyPem, privateKey: pem.privateKeyPem }
        } else {
          return { publicKey: keypair.publicKey, privateKey: keypair.privateKey }
        }
      }

      // Node.js crypto 支持的算法
      let type, options

      switch (algorithm) {
        case 'RSA':
          type = 'rsa'
          options = {
            modulusLength: keyLength,
            publicKeyEncoding: { type: 'spki', format: outputFormat === 'PEM' ? 'pem' : 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: outputFormat === 'PEM' ? 'pem' : 'der' }
          }
          break
        case 'DSA':
          type = 'dsa'
          // DSA divisorLength: 1024→160, 2048→256, 3072→256
          const divisorLength = keyLength >= 2048 ? 256 : 160
          options = {
            modulusLength: keyLength,
            divisorLength,
            publicKeyEncoding: { type: 'spki', format: outputFormat === 'PEM' ? 'pem' : 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: outputFormat === 'PEM' ? 'pem' : 'der' }
          }
          break
        case 'EC':
          type = 'ec'
          options = {
            namedCurve: curve,
            publicKeyEncoding: { type: 'spki', format: outputFormat === 'PEM' ? 'pem' : 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: outputFormat === 'PEM' ? 'pem' : 'der' }
          }
          break
        case 'EDDSA':
          // Ed25519 / Ed448
          type = curve // 'ed25519' or 'ed448'
          options = {
            publicKeyEncoding: { type: 'spki', format: outputFormat === 'PEM' ? 'pem' : 'der' },
            privateKeyEncoding: { type: 'pkcs8', format: outputFormat === 'PEM' ? 'pem' : 'der' }
          }
          break
        default:
          return { error: `不支持的算法: ${algorithm}` }
      }

      const keyPair = generateKeyPairSync(type, options)

      if (outputFormat === 'PEM') {
        return { publicKey: keyPair.publicKey, privateKey: keyPair.privateKey }
      } else {
        // DER → HEX
        return {
          publicKey: keyPair.publicKey.toString('hex'),
          privateKey: keyPair.privateKey.toString('hex')
        }
      }
    } catch (e) {
      return { error: `密钥生成失败: ${e.message}` }
    }
  })

  // ==================== 随机密钥生成 IPC ====================

  // 去除易混淆字符后的字符集
  const CHAR_SETS = {
    digits: '23456789',
    lowercase: 'abcdefghjkmnpqrstuvwxyz',
    uppercase: 'ABCDEFGHJKMNPQRSTUVWXYZ',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?'
  }

  const FULL_CHAR_SETS = {
    digits: '0123456789',
    lowercase: 'abcdefghijklmnopqrstuvwxyz',
    uppercase: 'ABCDEFGHIJKLMNOPQRSTUVWXYZ',
    symbols: '!@#$%^&*()_+-=[]{}|;:,.<>?~'
  }

  function buildCharset(options) {
    const sets = options.removeAmbiguous ? CHAR_SETS : FULL_CHAR_SETS
    let chars = ''
    if (options.digits) chars += sets.digits
    if (options.lowercase) chars += sets.lowercase
    if (options.uppercase) chars += sets.uppercase
    if (options.symbols) chars += sets.symbols
    return chars || sets.digits + sets.lowercase + sets.uppercase
  }

  function generateRandomString(charset, length) {
    const bytes = randomBytes(length * 2)
    let result = ''
    for (let i = 0; i < length; i++) {
      result += charset[bytes[i] % charset.length]
    }
    return result
  }

  ipcMain.handle('generate-random-keys', async (_event, params) => {
    const { type, count = 1, length = 32, options = {} } = params

    try {
      const results = []

      for (let i = 0; i < count; i++) {
        let value

        switch (type) {
          case 'random-string': {
            const charset = buildCharset(options)
            value = generateRandomString(charset, length)
            break
          }

          case 'uuid': {
            value = randomUUID()
            break
          }

          case 'base64': {
            const byteLen = Math.ceil(length / 8)
            const buf = randomBytes(byteLen)
            value = options.urlSafe
              ? buf.toString('base64url').replace(/=+$/, '')
              : buf.toString('base64').replace(/=+$/, '')
            break
          }

          case 'hex': {
            const byteLen = Math.ceil(length / 8)
            value = randomBytes(byteLen).toString('hex')
            break
          }

          case 'aes': {
            const keyBytes = { 128: 16, 192: 24, 256: 32 }[length] || 32
            const buf = randomBytes(keyBytes)
            value = options.format === 'hex' ? buf.toString('hex') : buf.toString('base64')
            break
          }

          case 'hmac': {
            const keyBytes = Math.max(16, Math.ceil(length / 8))
            const buf = randomBytes(keyBytes)
            // 使用指定算法对随机数据做一次 hash，得到固定长度输出
            const hash = createHash(options.algorithm || 'sha256').update(buf).digest()
            value = options.format === 'hex' ? hash.toString('hex') : hash.toString('base64')
            break
          }

          case 'salt': {
            const byteLen = Math.ceil(length / 8)
            const buf = randomBytes(byteLen)
            if (options.format === 'hex') {
              value = buf.toString('hex')
            } else if (options.format === 'base64') {
              value = buf.toString('base64')
            } else {
              value = buf.toString('hex')
            }
            break
          }

          case 'hash': {
            const byteLen = Math.max(4, Math.ceil(length / 8))
            const buf = randomBytes(byteLen)
            const hash = createHash(options.algorithm || 'sha256').update(buf).digest()
            value = hash.toString('hex')
            break
          }

          default:
            return { error: `不支持的密钥类型: ${type}` }
        }

        results.push(value)
      }

      return { results }
    } catch (e) {
      return { error: `密钥生成失败: ${e.message}` }
    }
  })

  // ==================== JWT 操作 IPC ====================

  function base64urlEncode(buf) {
    return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
  }

  function base64urlDecode(str) {
    let s = str.replace(/-/g, '+').replace(/_/g, '/')
    while (s.length % 4) s += '='
    return Buffer.from(s, 'base64')
  }

  function getSignAlgorithm(alg) {
    switch (alg) {
      case 'HS256': return 'sha256'
      case 'HS384': return 'sha384'
      case 'HS512': return 'sha512'
      case 'RS256': return 'RSA-SHA256'
      case 'RS384': return 'RSA-SHA384'
      case 'RS512': return 'RSA-SHA512'
      case 'ES256': return 'SHA256'
      case 'ES384': return 'SHA384'
      case 'ES512': return 'SHA512'
      case 'EdDSA': return null
      default: return null
    }
  }

  // timing-safe comparison
  function cryptoTimingSafeEqual(a, b) {
    if (a.length !== b.length) return false
    let result = 0
    for (let i = 0; i < a.length; i++) {
      result |= a[i] ^ b[i]
    }
    return result === 0
  }

  ipcMain.handle('jwt-operate', async (_event, params) => {
    const { operation, header, payload, token, secret, algorithm } = params

    try {
      if (operation === 'decode') {
        const parts = token.split('.')
        if (parts.length !== 3) {
          return { error: '无效的 JWT 格式，需要 Header.Payload.Signature 三部分' }
        }

        let headerJson, payloadJson
        try {
          headerJson = JSON.parse(base64urlDecode(parts[0]).toString('utf8'))
        } catch {
          return { error: 'Header 解析失败，不是有效的 Base64URL 编码 JSON' }
        }
        try {
          payloadJson = JSON.parse(base64urlDecode(parts[1]).toString('utf8'))
        } catch {
          return { error: 'Payload 解析失败，不是有效的 Base64URL 编码 JSON' }
        }

        return {
          header: headerJson,
          payload: payloadJson,
          signature: parts[2],
          headerRaw: parts[0],
          payloadRaw: parts[1]
        }
      }

      if (operation === 'encode') {
        const headerStr = JSON.stringify(header)
        const payloadStr = JSON.stringify(payload)
        const headerB64 = base64urlEncode(Buffer.from(headerStr, 'utf8'))
        const payloadB64 = base64urlEncode(Buffer.from(payloadStr, 'utf8'))
        const signingInput = `${headerB64}.${payloadB64}`

        let signature

        if (algorithm === 'none') {
          signature = ''
        } else if (algorithm.startsWith('HS')) {
          const hashAlg = getSignAlgorithm(algorithm)
          const hmac = createHmac(hashAlg, secret)
          hmac.update(signingInput)
          signature = base64urlEncode(hmac.digest())
        } else if (algorithm.startsWith('RS') || algorithm.startsWith('ES')) {
          const signAlg = getSignAlgorithm(algorithm)
          const signer = createSign(signAlg)
          signer.update(signingInput)
          signature = base64urlEncode(signer.sign(secret))
        } else if (algorithm === 'EdDSA') {
          const signer = createSign(null)
          signer.update(signingInput)
          signature = base64urlEncode(signer.sign(secret))
        } else {
          return { error: `不支持的签名算法: ${algorithm}` }
        }

        const jwt = `${headerB64}.${payloadB64}.${signature}`
        return { token: jwt }
      }

      if (operation === 'verify') {
        const parts = token.split('.')
        if (parts.length !== 3) {
          return { error: '无效的 JWT 格式' }
        }

        const signingInput = `${parts[0]}.${parts[1]}`
        const sigBuf = base64urlDecode(parts[2])
        let valid = false
        let reason = ''

        let payloadJson = {}
        try {
          payloadJson = JSON.parse(base64urlDecode(parts[1]).toString('utf8'))
        } catch { /* ignore */ }

        if (algorithm === 'none') {
          valid = parts[2] === ''
          if (!valid) reason = 'none 算法签名应为空'
        } else if (algorithm.startsWith('HS')) {
          const hashAlg = getSignAlgorithm(algorithm)
          const hmac = createHmac(hashAlg, secret)
          hmac.update(signingInput)
          const expected = hmac.digest()
          valid = expected.length === sigBuf.length && cryptoTimingSafeEqual(expected, sigBuf)
          if (!valid) reason = '签名验证失败，密钥不匹配或 Token 被篡改'
        } else if (algorithm.startsWith('RS') || algorithm.startsWith('ES')) {
          try {
            const signAlg = getSignAlgorithm(algorithm)
            const verifier = createVerify(signAlg)
            verifier.update(signingInput)
            valid = verifier.verify(secret, sigBuf)
            if (!valid) reason = '签名验证失败，密钥不匹配或 Token 被篡改'
          } catch (e) {
            return { error: `验证失败: ${e.message}` }
          }
        } else if (algorithm === 'EdDSA') {
          try {
            const verifier = createVerify(null)
            verifier.update(signingInput)
            valid = verifier.verify(secret, sigBuf)
            if (!valid) reason = '签名验证失败，密钥不匹配或 Token 被篡改'
          } catch (e) {
            return { error: `验证失败: ${e.message}` }
          }
        } else {
          return { error: `不支持的验证算法: ${algorithm}` }
        }

        const now = Math.floor(Date.now() / 1000)
        const timeChecks = []

        if (payloadJson.exp !== undefined) {
          const expired = now >= payloadJson.exp
          timeChecks.push({
            field: 'exp',
            label: '过期时间',
            value: new Date(payloadJson.exp * 1000).toISOString(),
            passed: !expired,
            message: expired ? 'Token 已过期' : 'Token 未过期'
          })
        }
        if (payloadJson.nbf !== undefined) {
          const notYet = now < payloadJson.nbf
          timeChecks.push({
            field: 'nbf',
            label: '生效时间',
            value: new Date(payloadJson.nbf * 1000).toISOString(),
            passed: !notYet,
            message: notYet ? 'Token 尚未生效' : 'Token 已生效'
          })
        }
        if (payloadJson.iat !== undefined) {
          timeChecks.push({
            field: 'iat',
            label: '签发时间',
            value: new Date(payloadJson.iat * 1000).toISOString(),
            passed: true,
            message: ''
          })
        }

        return {
          valid,
          reason: valid ? '' : reason,
          payload: payloadJson,
          timeChecks
        }
      }

      return { error: `不支持的操作: ${operation}` }
    } catch (e) {
      return { error: `JWT 操作失败: ${e.message}` }
    }
  })

  createWindow()
  perfLog('window-created')

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
