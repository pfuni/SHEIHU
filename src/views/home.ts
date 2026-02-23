import { setView, getUser } from '../state'
import { game, settings, auth, consoleLog } from '../ipc'
import { Dialog } from './dialog'

export function initHome() {
  const playBtn = document.getElementById('btn-play')
  const settingsBtn = document.getElementById('btn-settings')
  const logoutBtn = document.getElementById('btn-logout-home')
  const progressContainer = document.getElementById('launch-progress-container')
  const progressBar = document.getElementById('launch-progress-bar')
  const progressLabel = document.getElementById('launch-progress-label')
  const progressPercent = document.getElementById('launch-progress-percent')
  
  // Console elements
  const consolePanel = document.getElementById('console-panel')
  const consoleOutput = document.getElementById('console-output')
  const clearConsoleBtn = document.getElementById('btn-clear-console')
  
  // Nav items for tab switching
  const navItems = document.querySelectorAll('.nav-item[data-page]')
  const gameCard = document.querySelector('.game-card') as HTMLElement

  let totalToDownload = 0
  let totalDownloadedByType: { type: string; size: number }[] = []

  const setIndeterminate = (active: boolean) => {
    if (!progressBar || !progressPercent) return

    if (active) {
      progressBar.classList.add('indeterminate')
      progressPercent.style.display = 'none'
    } else {
      progressBar.classList.remove('indeterminate')
      progressPercent.style.display = 'block'
    }
  }
  
  // Tab switching
  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      const page = item.getAttribute('data-page')
      navItems.forEach((i) => i.classList.remove('active'))
      item.classList.add('active')
      
      // Hide all panels
      gameCard?.classList.add('hidden')
      consolePanel?.classList.add('hidden')
      
      // Show selected panel
      if (page === 'dashboard') {
        gameCard?.classList.remove('hidden')
      } else if (page === 'console') {
        consolePanel?.classList.remove('hidden')
      }
    })
  })
  
  // Console logging
  const addLogEntry = (type: string, message: string, time: string) => {
    if (!consoleOutput) return
    
    const entry = document.createElement('div')
    entry.className = 'log-entry'
    
    const timeStr = new Date(time).toLocaleTimeString('en-US', { 
      hour12: false, 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    })
    
    entry.innerHTML = `
      <span class="log-time">[${timeStr}]</span>
      <span class="log-type ${type}">${type.toUpperCase()}</span>
      <span class="log-message">${escapeHtml(message)}</span>
    `
    
    consoleOutput.appendChild(entry)
    consoleOutput.scrollTop = consoleOutput.scrollHeight
  }
  
  const escapeHtml = (text: string) => {
    const div = document.createElement('div')
    div.textContent = text
    return div.innerHTML
  }
  
  // Listen for console logs
  consoleLog.onLog((log) => {
    addLogEntry(log.type, log.message, log.time)
  })
  
  // Clear console
  clearConsoleBtn?.addEventListener('click', () => {
    if (consoleOutput) consoleOutput.innerHTML = ''
  })

  settingsBtn?.addEventListener('click', () => {
    setView('settings')
  })

  logoutBtn?.addEventListener('click', async () => {
    if (
      await Dialog.show('Log out?', [
        { text: 'Cancel', type: 'cancel' },
        { text: 'Logout', type: 'danger' }
      ])
    ) {
      await auth.logout()
      setView('login')
    }
  })

  playBtn?.addEventListener('click', async () => {
    setIndeterminate(true)
    if (playBtn) playBtn.style.display = 'none'
    if (progressContainer) progressContainer.classList.remove('hidden')
    if (progressBar) progressBar.style.width = '0%'
    if (progressPercent) progressPercent.innerText = '0%'

    const user = getUser()
    if (!user) return

    const config = await settings.get()

    const message = `
Ready to launch the game with the following settings:
      
👤 Account: ${user.name}
🧠 RAM: ${config.memory.min} - ${config.memory.max}
☕️ Java: ${config.java}
🖥️ Resolution: ${config.resolution.width}x${config.resolution.height}
🚀 Action on launch: ${config.launcherAction}
    `

    console.log(message)
    game.launch({ account: user, settings: config })
  })

  game.launchComputeDownload(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Preparing download...'
    if (progressPercent) progressPercent.innerText = ''
  })
  game.launchDownload((download) => {
    setIndeterminate(false)
    totalToDownload = download.total?.size || 100
    if (progressLabel) progressLabel.innerText = `Downloading files...`
  })
  game.downloadProgress((progress: any) => {
    // Handle new format: { type, name, current, total }
    if (progress.current !== undefined && progress.total !== undefined) {
      if (progressBar && progressLabel && progressPercent) {
        const percent = Math.round((progress.current / progress.total) * 100)
        progressBar.style.width = `${percent}%`
        progressLabel.innerText = progress.name || `Downloading ${progress.type}...`
        progressPercent.innerText = `${percent}%`
      }
      return
    }
    
    // Legacy format handling
    if (progress.downloaded?.size !== undefined) {
      if (!totalDownloadedByType.find((t) => t.type === progress.type)) {
        totalDownloadedByType.push({ type: progress.type, size: progress.downloaded.size })
      } else {
        totalDownloadedByType[totalDownloadedByType.findIndex((t) => t.type === progress.type)].size = progress.downloaded.size
      }
      if (progressBar && progressLabel && progressPercent) {
        const downloadedSum = totalDownloadedByType.reduce((acc, curr) => acc + curr.size, 0)
        progressBar.style.width = `${Math.min((downloadedSum / totalToDownload) * 100, 100)}%`
        progressLabel.innerText = `Downloading ${progress.type === 'JAVA' ? 'Java' : 'game files'}...`
        progressPercent.innerText = `${Math.round(Math.min((downloadedSum / totalToDownload) * 100, 100))}%`
      }
    }
  })
  game.launchInstallLoader(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extracting files...'
    if (progressPercent) progressPercent.innerText = ''
  })
  game.launchExtractNatives(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extracting files...'
  })
  game.launchCopyAssets(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Extracting files...'
  })
  game.launchPatchLoader(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Finalizing setup...'
  })
  game.launchLaunch(() => {
    setIndeterminate(true)
    if (progressLabel) progressLabel.innerText = 'Launching game...'
  })
  game.launched(() => {
    setTimeout(() => {
      if (playBtn) playBtn.style.display = 'block'
      if (progressContainer) progressContainer.classList.add('hidden')
      if (progressBar) progressBar.style.width = '0%'
      if (progressPercent) progressPercent.innerText = ''
    }, 10000)
  })
}
