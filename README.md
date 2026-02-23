<p align="center">
  <img src="./src/static/images/LOGO_WHITE.svg" alt="SHEIHU" width="200"/>
</p>

<h1 align="center">SHEIHU Launcher</h1>

<p align="center">
  <b>A modern, sleek Minecraft launcher for WynnCast</b>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Minecraft-1.21.11-62B47A?style=for-the-badge&logo=minecraft&logoColor=white" alt="Minecraft Version"/>
  <img src="https://img.shields.io/badge/Fabric-0.18.4-DBB68A?style=for-the-badge" alt="Fabric Version"/>
  <img src="https://img.shields.io/badge/Electron-39-47848F?style=for-the-badge&logo=electron&logoColor=white" alt="Electron"/>
  <img src="https://img.shields.io/badge/Platform-Windows-0078D6?style=for-the-badge&logo=windows&logoColor=white" alt="Platform"/>
</p>

---
[WEBSITE](https://sheihu.eu/)
## Features

- **One-Click Play** — Automatically downloads and installs everything you need
- **Microsoft Authentication** — Secure login with your Microsoft account
- **Auto Java Installation** — Downloads Java 21 (Adoptium Temurin) automatically
- **Fabric Mod Loader** — Pre-configured with Fabric for optimal mod support
- **WynnCast Modpack** — Automatically installs and updates WynnCast mods
- **Modern UI** — Clean, dark interface with real-time console output
- **Smart Memory Management** — Configurable RAM allocation

## Quick Start

1. Download the latest release from [Releases](https://github.com/pfuni/SHEIHU/releases)
2. Run `SHEIHU-Setup.exe`
3. Sign in with your Microsoft account
4. Click **Play WynnCast**

That's it! The launcher handles everything else automatically.

## What Gets Installed

| Component | Version | Location |
|-----------|---------|----------|
| Java 21 (Temurin) | Latest | `%APPDATA%\.SHEIHU\runtime` |
| Minecraft | 1.21.11 | `%APPDATA%\.SHEIHU` |
| Fabric Loader | 0.18.4 | `%APPDATA%\.SHEIHU\versions` |
| WynnCast Mods | Latest | `%APPDATA%\.SHEIHU\mods` |

## ⚙️ Configuration

Access settings via the **gear icon** in the sidebar:

- **RAM Allocation** — Set minimum and maximum memory (default: 2-8 GB)
- **Game Resolution** — Configure window size
- **Account Management** — View account info and logout

## Development

```bash
# Clone the repository
git clone https://github.com/pfuni/SHEIHU.git
cd SHEIHU

# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Create Windows installer
npm run dist:win
```

## Project Structure

```
├── electron/           # Electron main process
│   ├── main.ts        # App entry point
│   ├── preload.ts     # Preload scripts
│   └── handlers/      # IPC handlers
├── src/               # Renderer process
│   ├── views/         # UI components
│   └── static/        # Styles & assets
├── build/             # App icons
└── scripts/           # Build scripts
```

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>SHEIHU</b> — Play Wynncraft with QOL
</p>
