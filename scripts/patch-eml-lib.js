const fs = require('fs')
const path = require('path')

const filePath = path.join(__dirname, '..', 'node_modules', 'eml-lib', 'lib', 'auth', 'microsoftgui.js')

if (!fs.existsSync(filePath)) {
  console.log('eml-lib microsoftgui.js not found, skipping patch')
  process.exit(0)
}

let content = fs.readFileSync(filePath, 'utf-8')

// Check if already patched
if (content.includes('icon: require')) {
  console.log('eml-lib already patched')
  process.exit(0)
}

// Add icon to BrowserWindow options
const oldCode = `this.window = new electron.BrowserWindow({
            parent: this.mainWindow,
            modal: true,
            width: 630,
            height: 650,
            resizable: false,
            minimizable: false,
            center: true,`

const newCode = `this.window = new electron.BrowserWindow({
            parent: this.mainWindow,
            modal: true,
            width: 630,
            height: 650,
            resizable: false,
            minimizable: false,
            center: true,
            icon: require('path').join(__dirname, '..', '..', '..', '..', 'build', 'icon.ico'),`

if (content.includes(oldCode)) {
  content = content.replace(oldCode, newCode)
  fs.writeFileSync(filePath, content)
  console.log('eml-lib patched successfully')
} else {
  console.log('Could not find target code to patch')
}
