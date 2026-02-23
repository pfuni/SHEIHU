import { ipcMain } from 'electron'

// AdminTool disabled - returning null for maintenance
export function registerMaintenanceHandlers() {
  ipcMain.handle('maintenance:get', async () => {
    // AdminTool not configured - no maintenance mode
    return null
  })
}

