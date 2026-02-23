import { ipcMain, BrowserWindow, app } from 'electron'
import { Client } from 'minecraft-launcher-core'
import type { Account } from 'eml-lib'
import type { IGameSettings } from './settings'
import * as path from 'node:path'
import * as fs from 'node:fs'
import * as https from 'node:https'
import * as http from 'node:http'
import AdmZip from 'adm-zip'

// Game configuration
const VERSION = '1.21.11'
const FABRIC_VERSION = '0.18.4'
const GAME_DIR = path.join(app.getPath('appData'), '.SHEIHU')
const JAVA_ROOT = path.join(GAME_DIR, 'runtime')
const WYNNCAST_ZIP_URL = 'https://github.com/SheihuGit/WynnCast/raw/main/WynnCast.zip'

// Mojang API URLs
const VERSION_MANIFEST_URL = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json'
const FABRIC_META_URL = 'https://meta.fabricmc.net/v2'
const RESOURCES_URL = 'https://resources.download.minecraft.net'

// Helper to fetch JSON with redirect support
function fetchJson(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    const doRequest = (reqUrl: string) => {
      const protocol = reqUrl.startsWith('https') ? https : http
      protocol.get(reqUrl, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307 || res.statusCode === 308) {
          const location = res.headers.location
          if (location) {
            // Handle relative redirects
            const newUrl = location.startsWith('http') ? location : new URL(location, reqUrl).href
            doRequest(newUrl)
            return
          }
        }
        let data = ''
        res.on('data', chunk => data += chunk)
        res.on('end', () => {
          try { resolve(JSON.parse(data)) }
          catch (e) { reject(e) }
        })
      }).on('error', reject)
    }
    doRequest(url)
  })
}

// Helper to download files with progress and proper redirect handling
function downloadFile(url: string, dest: string, onProgress?: (percent: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    // Ensure directory exists
    const dir = path.dirname(dest)
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true })
    }
    
    const doDownload = (reqUrl: string) => {
      const protocol = reqUrl.startsWith('https') ? https : http
      
      protocol.get(reqUrl, (response) => {
        // Handle redirects
        if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
          const location = response.headers.location
          if (location) {
            const newUrl = location.startsWith('http') ? location : new URL(location, reqUrl).href
            console.log(`Redirecting to: ${newUrl}`)
            doDownload(newUrl)
            return
          }
        }
        
        if (response.statusCode !== 200) {
          reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`))
          return
        }
        
        const totalSize = parseInt(response.headers['content-length'] || '0', 10)
        let downloadedSize = 0
        
        const file = fs.createWriteStream(dest)
        
        response.on('data', (chunk) => {
          downloadedSize += chunk.length
          if (onProgress && totalSize > 0) {
            onProgress((downloadedSize / totalSize) * 100)
          }
        })
        
        response.pipe(file)
        
        file.on('finish', () => {
          file.close()
          console.log(`Downloaded ${dest} (${downloadedSize} bytes)`)
          resolve()
        })
        
        file.on('error', (err) => {
          fs.unlink(dest, () => {})
          reject(err)
        })
      }).on('error', (err) => {
        fs.unlink(dest, () => {})
        reject(err)
      })
    }
    
    doDownload(url)
  })
}

// Download Minecraft version (client, libraries, assets)
async function installMinecraft(mainWindow: BrowserWindow): Promise<any> {
  const versionsDir = path.join(GAME_DIR, 'versions', VERSION)
  const clientJar = path.join(versionsDir, `${VERSION}.jar`)
  const versionJson = path.join(versionsDir, `${VERSION}.json`)
  
  // Check if already installed
  if (fs.existsSync(clientJar) && fs.existsSync(versionJson)) {
    console.log(`Minecraft ${VERSION} already installed`)
    return JSON.parse(fs.readFileSync(versionJson, 'utf-8'))
  }
  
  console.log(`Installing Minecraft ${VERSION}...`)
  mainWindow.webContents.send('game:download_progress', { 
    type: 'VERSION', 
    name: `Downloading Minecraft ${VERSION}...`,
    current: 0, 
    total: 100 
  })
  
  // Fetch version manifest
  const manifest = await fetchJson(VERSION_MANIFEST_URL)
  const versionInfo = manifest.versions.find((v: any) => v.id === VERSION)
  if (!versionInfo) throw new Error(`Version ${VERSION} not found`)
  
  // Fetch version details
  const versionData = await fetchJson(versionInfo.url)
  
  // Save version JSON
  if (!fs.existsSync(versionsDir)) {
    fs.mkdirSync(versionsDir, { recursive: true })
  }
  fs.writeFileSync(versionJson, JSON.stringify(versionData, null, 2))
  
  // Download client JAR
  mainWindow.webContents.send('game:download_progress', { 
    type: 'CLIENT', 
    name: 'Downloading client...',
    current: 10, 
    total: 100 
  })
  await downloadFile(versionData.downloads.client.url, clientJar)
  
  // Download libraries
  const libraries = versionData.libraries || []
  const libsDir = path.join(GAME_DIR, 'libraries')
  let libCount = 0
  
  for (const lib of libraries) {
    if (lib.downloads?.artifact) {
      const artifact = lib.downloads.artifact
      const libPath = path.join(libsDir, artifact.path)
      
      if (!fs.existsSync(libPath)) {
        mainWindow.webContents.send('game:download_progress', { 
          type: 'LIBRARY', 
          name: `Libraries (${++libCount}/${libraries.length})`,
          current: 10 + Math.round((libCount / libraries.length) * 40), 
          total: 100 
        })
        await downloadFile(artifact.url, libPath)
      } else {
        libCount++
      }
    }
    
    // Download natives if present
    if (lib.downloads?.classifiers) {
      const nativeKey = lib.natives?.windows?.replace('${arch}', 'x64') || 'natives-windows'
      const native = lib.downloads.classifiers[nativeKey]
      if (native) {
        const nativePath = path.join(libsDir, native.path)
        if (!fs.existsSync(nativePath)) {
          await downloadFile(native.url, nativePath)
        }
      }
    }
  }
  
  // Download assets
  mainWindow.webContents.send('game:download_progress', { 
    type: 'ASSETS', 
    name: 'Downloading asset index...',
    current: 50, 
    total: 100 
  })
  
  const assetIndex = versionData.assetIndex
  const assetsDir = path.join(GAME_DIR, 'assets')
  const indexDir = path.join(assetsDir, 'indexes')
  const objectsDir = path.join(assetsDir, 'objects')
  
  if (!fs.existsSync(indexDir)) fs.mkdirSync(indexDir, { recursive: true })
  if (!fs.existsSync(objectsDir)) fs.mkdirSync(objectsDir, { recursive: true })
  
  const indexPath = path.join(indexDir, `${assetIndex.id}.json`)
  if (!fs.existsSync(indexPath)) {
    await downloadFile(assetIndex.url, indexPath)
  }
  
  const assets = JSON.parse(fs.readFileSync(indexPath, 'utf-8'))
  const objects = Object.values(assets.objects) as any[]
  let assetCount = 0
  
  for (const obj of objects) {
    const hash = obj.hash
    const subdir = hash.substring(0, 2)
    const assetPath = path.join(objectsDir, subdir, hash)
    
    if (!fs.existsSync(assetPath)) {
      if (assetCount % 100 === 0) {
        mainWindow.webContents.send('game:download_progress', { 
          type: 'ASSETS', 
          name: `Assets (${assetCount}/${objects.length})`,
          current: 50 + Math.round((assetCount / objects.length) * 30), 
          total: 100 
        })
      }
      await downloadFile(`${RESOURCES_URL}/${subdir}/${hash}`, assetPath)
    }
    assetCount++
  }
  
  console.log(`Minecraft ${VERSION} installed successfully`)
  return versionData
}

// Install Fabric loader
async function installFabric(mainWindow: BrowserWindow): Promise<string> {
  const fabricId = `fabric-loader-${FABRIC_VERSION}-${VERSION}`
  const fabricDir = path.join(GAME_DIR, 'versions', fabricId)
  const fabricJson = path.join(fabricDir, `${fabricId}.json`)
  
  if (fs.existsSync(fabricJson)) {
    console.log('Fabric already installed')
    return fabricId
  }
  
  console.log(`Installing Fabric ${FABRIC_VERSION}...`)
  mainWindow.webContents.send('game:download_progress', { 
    type: 'FABRIC', 
    name: 'Installing Fabric loader...',
    current: 80, 
    total: 100 
  })
  
  // Fetch Fabric profile - correct URL format: /versions/loader/{game_version}/{loader_version}/profile/json
  const profileUrl = `${FABRIC_META_URL}/versions/loader/${VERSION}/${FABRIC_VERSION}/profile/json`
  console.log('Fetching Fabric profile from:', profileUrl)
  const fabricProfile = await fetchJson(profileUrl)
  
  // Save Fabric JSON
  if (!fs.existsSync(fabricDir)) {
    fs.mkdirSync(fabricDir, { recursive: true })
  }
  fs.writeFileSync(fabricJson, JSON.stringify(fabricProfile, null, 2))
  
  // Download Fabric libraries
  const libsDir = path.join(GAME_DIR, 'libraries')
  const fabricLibs = fabricProfile.libraries || []
  let libIndex = 0
  
  for (const lib of fabricLibs) {
    libIndex++
    const nameParts = lib.name.split(':')
    const [group, artifact, version] = nameParts
    const groupPath = group.replace(/\./g, '/')
    const libPath = path.join(libsDir, groupPath, artifact, version, `${artifact}-${version}.jar`)
    
    if (!fs.existsSync(libPath)) {
      const baseUrl = lib.url || 'https://maven.fabricmc.net/'
      const url = `${baseUrl}${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`
      
      mainWindow.webContents.send('game:download_progress', { 
        type: 'FABRIC', 
        name: `Fabric libs (${libIndex}/${fabricLibs.length})`,
        current: 80 + Math.round((libIndex / fabricLibs.length) * 10), 
        total: 100 
      })
      
      try {
        await downloadFile(url, libPath)
      } catch (e) {
        // Try Maven Central as fallback
        const mavenUrl = `https://repo1.maven.org/maven2/${groupPath}/${artifact}/${version}/${artifact}-${version}.jar`
        try {
          await downloadFile(mavenUrl, libPath)
        } catch (e2) {
          console.warn(`Could not download ${lib.name}`)
        }
      }
    }
  }
  
  console.log('Fabric installed successfully')
  return fabricId
}

// Download and extract Java 21 from Adoptium
async function downloadJava(mainWindow: BrowserWindow): Promise<string> {
  const javaExe = path.join(JAVA_ROOT, 'bin', 'java.exe')
  
  if (fs.existsSync(javaExe)) {
    console.log('Java 21 already installed')
    return javaExe
  }
  
  if (!fs.existsSync(JAVA_ROOT)) {
    fs.mkdirSync(JAVA_ROOT, { recursive: true })
  }
  
  mainWindow.webContents.send('game:download_progress', { 
    type: 'JAVA', 
    name: 'Java 21 (Temurin)',
    current: 0, 
    total: 100 
  })
  
  const apiUrl = 'https://api.adoptium.net/v3/binary/latest/21/ga/windows/x64/jdk/hotspot/normal/eclipse'
  const zipPath = path.join(JAVA_ROOT, 'java21.zip')
  
  console.log('Downloading Java 21 (Temurin)...')
  
  await downloadFile(apiUrl, zipPath, (percent) => {
    mainWindow.webContents.send('game:download_progress', { 
      type: 'JAVA', 
      name: 'Java 21 (Temurin)',
      current: Math.round(percent), 
      total: 100 
    })
  })
  
  console.log('Extracting Java...')
  mainWindow.webContents.send('game:download_progress', { 
    type: 'EXTRACT', 
    name: 'Extracting Java...',
    current: 0, 
    total: 100 
  })
  
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(JAVA_ROOT, true)
  
  // Move files up one level (Adoptium extracts to a subfolder)
  const dirs = fs.readdirSync(JAVA_ROOT).filter(d => 
    fs.statSync(path.join(JAVA_ROOT, d)).isDirectory() && d.startsWith('jdk')
  )
  
  if (dirs.length > 0) {
    const extractedDir = path.join(JAVA_ROOT, dirs[0])
    const items = fs.readdirSync(extractedDir)
    
    for (const item of items) {
      const src = path.join(extractedDir, item)
      const dest = path.join(JAVA_ROOT, item)
      fs.renameSync(src, dest)
    }
    fs.rmdirSync(extractedDir)
  }
  
  fs.unlinkSync(zipPath)
  console.log('Java 21 installed successfully')
  
  return javaExe
}

// Download and extract WynnCast assets
async function downloadWynnCast(mainWindow: BrowserWindow): Promise<void> {
  const zipPath = path.join(GAME_DIR, 'WynnCast.zip')
  const markerFile = path.join(GAME_DIR, '.wynncast_installed')
  
  // Skip if already installed
  if (fs.existsSync(markerFile)) {
    console.log('WynnCast assets already installed')
    return
  }
  
  mainWindow.webContents.send('game:download_progress', { 
    type: 'WYNNCAST', 
    name: 'WynnCast assets',
    current: 90, 
    total: 100 
  })
  
  console.log('Downloading WynnCast assets from GitHub...')
  
  await downloadFile(WYNNCAST_ZIP_URL, zipPath, (percent) => {
    mainWindow.webContents.send('game:download_progress', { 
      type: 'WYNNCAST', 
      name: 'WynnCast assets',
      current: 90 + Math.round(percent * 0.1), 
      total: 100 
    })
  })
  
  console.log('Extracting WynnCast assets...')
  
  const zip = new AdmZip(zipPath)
  zip.extractAllTo(GAME_DIR, true)
  
  fs.unlinkSync(zipPath)
  
  // Create marker file
  fs.writeFileSync(markerFile, new Date().toISOString())
  
  console.log('WynnCast assets installed')
}

export function registerLauncherHandlers(mainWindow: BrowserWindow) {
  const launcher = new Client()

  // Helper to send console logs to renderer
  const sendLog = (type: 'info' | 'debug' | 'warn' | 'error' | 'game' | 'java', message: string) => {
    mainWindow.webContents.send('console:log', { type, message, time: new Date().toISOString() })
  }

  launcher.on('debug', (e) => {
    console.log('[Debug]', e)
    sendLog('debug', e)
  })
  launcher.on('data', (e) => {
    console.log('[Data]', e)
    sendLog('game', e)
  })
  
  launcher.on('progress', (e) => {
    mainWindow.webContents.send('game:download_progress', {
      type: e.type,
      task: e.task,
      total: e.total
    })
  })

  launcher.on('download-status', (e) => {
    mainWindow.webContents.send('game:download_progress', {
      name: e.name,
      current: e.current,
      total: e.total,
      type: e.type
    })
  })

  ipcMain.handle('game:launch', async (_event, payload: { account: Account; settings: IGameSettings }) => {
    const { account, settings } = payload
    console.log('Launching SHEIHU...')
    sendLog('info', '=== Starting SHEIHU Launcher ===')
    sendLog('info', `Account: ${account.name}`)

    try {
      // Ensure base directory exists
      if (!fs.existsSync(GAME_DIR)) {
        fs.mkdirSync(GAME_DIR, { recursive: true })
      }

      mainWindow.webContents.send('game:launch_compute_download')
      mainWindow.webContents.send('game:launch_download', { total: { amount: 0, size: 0 } })

      // 1. Download Java 21
      sendLog('info', 'Checking Java 21...')
      const javaExe = await downloadJava(mainWindow)
      sendLog('info', `Java path: ${javaExe}`)
      console.log('Using Java:', javaExe)

      // 2. Download Minecraft assets and libraries
      sendLog('info', `Installing Minecraft ${VERSION}...`)
      await installMinecraft(mainWindow)
      sendLog('info', 'Minecraft installed')

      // 3. Install Fabric loader
      sendLog('info', `Installing Fabric ${FABRIC_VERSION}...`)
      const fabricId = await installFabric(mainWindow)
      sendLog('info', `Fabric ready: ${fabricId}`)

      // 4. Download WynnCast assets (mods, configs, etc.)
      sendLog('info', 'Checking WynnCast assets...')
      await downloadWynnCast(mainWindow)
      sendLog('info', 'WynnCast assets ready')

      mainWindow.webContents.send('game:download_progress', { 
        type: 'LAUNCH', 
        name: 'Starting game...',
        current: 100, 
        total: 100 
      })
      
      // 5. Launch Minecraft with Fabric
      // Parse memory values - strip any suffix (M/G) and convert to MB
      const parseMemoryMB = (val: string | number): number => {
        const str = String(val)
        const num = parseFloat(str.replace(/[MG]/gi, ''))
        // If original had G suffix, convert GB to MB
        if (/G/i.test(str)) {
          return Math.round(num * 1024)
        }
        return Math.round(num)
      }
      const minMem = parseMemoryMB(settings.memory.min)
      const maxMem = parseMemoryMB(settings.memory.max)
      
      const opts = {
        clientPackage: null,
        authorization: {
          access_token: account.accessToken,
          client_token: account.uuid,
          uuid: account.uuid,
          name: account.name,
          user_properties: {}
        },
        root: GAME_DIR,
        version: {
          number: VERSION,
          type: 'release',
          custom: fabricId
        },
        javaPath: javaExe,
        memory: {
          min: `${minMem}M`,
          max: `${maxMem}M`
        },
        window: {
          width: settings.resolution.width,
          height: settings.resolution.height,
          fullscreen: settings.resolution.fullscreen
        },
        overrides: {
          detached: true
        }
      }

      console.log('Launch options:', JSON.stringify(opts, null, 2))
      sendLog('info', `Memory: ${minMem}M - ${maxMem}M`)
      sendLog('info', `Resolution: ${settings.resolution.width}x${settings.resolution.height}`)
      sendLog('info', 'Starting Minecraft process...')
      
      const mcProcess = await launcher.launch(opts as any)

      if (mcProcess) {
        // Capture stdout
        mcProcess.stdout?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter((l: string) => l.trim())
          lines.forEach((line: string) => sendLog('java', line))
        })
        
        // Capture stderr
        mcProcess.stderr?.on('data', (data: Buffer) => {
          const lines = data.toString().split('\n').filter((l: string) => l.trim())
          lines.forEach((line: string) => sendLog('error', line))
        })
        
        mcProcess.on('close', (code: number) => {
          console.log(`Minecraft exited with code ${code}`)
          sendLog('info', `Minecraft exited with code ${code}`)
          mainWindow.webContents.send('game:close', { code })
          
          if (settings.launcherAction === 'close') {
            app.quit()
          } else if (settings.launcherAction === 'hide') {
            mainWindow.show()
          }
        })

        mcProcess.on('error', (err: Error) => {
          console.error('Minecraft process error:', err)
          sendLog('error', `Process error: ${err.message}`)
          mainWindow.webContents.send('game:error', { message: err.message })
        })

        mainWindow.webContents.send('game:launched')
        sendLog('info', 'Minecraft launched successfully!')
        
        if (settings.launcherAction === 'close') {
          setTimeout(() => app.quit(), 5000)
        } else if (settings.launcherAction === 'hide') {
          mainWindow.minimize()
        }
      }

      mainWindow.webContents.send('game:launch_done')
      return { success: true }
    } catch (err: any) {
      console.error('Launch failed:', err)
      sendLog('error', `Launch failed: ${err.message}`)
      mainWindow.webContents.send('game:error', { message: err.message })
      return { success: false, error: err.message }
    }
  })
}
