import { ipcMain } from 'electron'

// AdminTool disabled - returning null for background
export function registerBackgroundHandlers() {
  ipcMain.handle('background:get', async () => {
    // AdminTool not configured - no background
    return null
  })
}

