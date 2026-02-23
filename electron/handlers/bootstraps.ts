import type Electron from 'electron'
import { ipcMain } from 'electron'

// AdminTool disabled - returning stub data for bootstraps
export function registerBootstrapHandlers(mainWindow: Electron.BrowserWindow) {
  ipcMain.handle('bootstraps:check', async () => {
    // AdminTool not configured - no updates
    return { updateAvailable: false }
  })

  ipcMain.handle('bootstraps:download', async () => {
    return null
  })

  ipcMain.handle('bootstraps:install', async () => {
    return null
  })
}
