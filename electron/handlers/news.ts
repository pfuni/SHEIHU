import { ipcMain } from 'electron'

// AdminTool disabled - returning empty arrays for news
export function registerNewsHandlers() {
  ipcMain.handle('news:get_news', async () => {
    // AdminTool not configured - no news
    return []
  })

  ipcMain.handle('news:get_categories', async () => {
    // AdminTool not configured - no categories
    return []
  })
}

