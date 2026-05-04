# SADIYA-PRO

SADIYA is a free-stack desktop AI OS layer MVP for Ubuntu.

## Features

- Modern Electron + React desktop UI
- Chat console
- Web Speech API voice input
- Browser speech synthesis voice output
- Gemini adapter with mock fallback
- Safe execution engine
- Intent detection and command routing
- Local task queue
- Multi-agent registry
- Local memory store
- Web search launcher
- Safe file search and system info commands
- Future-ready plugin skeleton

## Free AI Setup

SADIYA uses Gemini when an API key is available.

```bash
export SADIYA_GEMINI_API_KEY="your-gemini-key"
```

Without a key, SADIYA runs in mock mode and local commands still work.

## Commands

Run commands from the SADIYA project folder, not from `C:\Users\...` or your home folder.

```bash
npm install
npm run dev
npm run lint
npm run typecheck
npm run build
npm start
```

## Windows PowerShell

Open PowerShell inside the SADIYA project folder first:

```powershell
cd C:\path\to\sadiya
dir package.json
npm install
npm run lint
npm run typecheck
npm run build
npm start
```

For direct run after dependencies are installed:

```powershell
cd C:\path\to\sadiya
npm start
```

Install a Desktop shortcut on Windows:

```powershell
cd C:\path\to\sadiya
powershell -ExecutionPolicy Bypass -File .\install-sadiya.ps1
```

After that, double-click `SADIYA` on the Desktop.

If you see `Missing script: "lint"` or `Missing script: "build"`, you are in the wrong folder. Run `dir package.json`; it must show SADIYA's `package.json`.

`install-sadiya.sh` is only for Linux. On Windows use `install-sadiya.ps1`.

## Example Commands

- `system info`
- `search AI news`
- `find file resume`
- `remember my name is Sariya`
- `kya yaad hai`
- `open chrome`
- `terminal kholo`

## Local Data

SADIYA stores local app state in Electron user data as `sadiya-state.json`.
