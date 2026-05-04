$ErrorActionPreference = "Stop"

$AppDir = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $AppDir

if (-not (Test-Path "package.json")) {
  throw "package.json not found. Run this script from the SADIYA project folder."
}

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  npm install
}

Write-Host "Building SADIYA..."
npm run build

Write-Host "Starting SADIYA..."
npm start
