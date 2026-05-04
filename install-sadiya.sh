#!/usr/bin/env bash
set -euo pipefail

APP_DIR="/home/ubuntu/sadiya"
DESKTOP_FILE="/home/ubuntu/Desktop/SADIYA.desktop"

cd "$APP_DIR"
npm run build

cat > "$DESKTOP_FILE" <<DESKTOP
[Desktop Entry]
Name=SADIYA
Comment=Desktop AI OS assistant
Exec=bash -lc 'cd "$APP_DIR" && npm start'
Icon=utilities-terminal
Terminal=false
Type=Application
Categories=Utility;AI;
DESKTOP

chmod +x "$DESKTOP_FILE"
chmod +x "$APP_DIR/node_modules/.bin/electron" || true
echo "SADIYA desktop launcher installed at $DESKTOP_FILE"
