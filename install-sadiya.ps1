$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppDir

if (-not (Test-Path "package.json")) {
  throw "package.json not found. Put this file inside the SADIYA project folder, then run it again."
}

if (-not (Get-Command npm -ErrorAction SilentlyContinue)) {
  throw "npm not found. Install Node.js LTS first: https://nodejs.org/"
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Building SADIYA..."
npm run build

$ShortcutPath = Join-Path ([Environment]::GetFolderPath("Desktop")) "SADIYA.lnk"
$TargetPath = Join-Path $AppDir "run-sadiya.ps1"
$WorkingDir = $AppDir

$Shell = New-Object -ComObject WScript.Shell
$Shortcut = $Shell.CreateShortcut($ShortcutPath)
$Shortcut.TargetPath = "powershell.exe"
$Shortcut.Arguments = "-ExecutionPolicy Bypass -File `"$TargetPath`""
$Shortcut.WorkingDirectory = $WorkingDir
$Shortcut.IconLocation = "powershell.exe,0"
$Shortcut.Save()

Write-Host "SADIYA shortcut installed at $ShortcutPath"
Write-Host "You can now double-click SADIYA on Desktop."
