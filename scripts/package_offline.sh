#!/usr/bin/env bash
set -euo pipefail

BASE_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
EXPORT_DIR="${BASE_DIR}/export"
PKG_NAME="${1:-BESIII_PhoenixOffline}"
PKG_DIR="${EXPORT_DIR}/${PKG_NAME}"
ZIP_PATH="${EXPORT_DIR}/${PKG_NAME}.zip"

echo "[1/5] Prepare export directory..."
mkdir -p "${EXPORT_DIR}"
rm -rf "${PKG_DIR}"
mkdir -p "${PKG_DIR}"

echo "[2/5] Copy runtime files..."
cp -r "${BASE_DIR}/web" "${PKG_DIR}/web"
mkdir -p "${PKG_DIR}/data"
cp -r "${BASE_DIR}/data/views" "${PKG_DIR}/data/views"
mkdir -p "${PKG_DIR}/data/events"
cp "${BASE_DIR}"/data/events/*.json "${PKG_DIR}/data/events/"

if [[ -f "${BASE_DIR}/PROJECT_SUMMARY.txt" ]]; then
  cp "${BASE_DIR}/PROJECT_SUMMARY.txt" "${PKG_DIR}/PROJECT_SUMMARY.txt"
fi

echo "[3/5] Write launcher/readme files..."
cat > "${PKG_DIR}/README_OFFLINE.txt" <<'EOF'
BESIII Phoenix Offline Demo Package

Quick Start (Windows)
1) Install Python 3 (if needed).
2) Double-click START_WINDOWS.bat.
3) Browser opens: http://127.0.0.1:8010/web/

Quick Start (Linux)
1) chmod +x START_LINUX.sh
2) ./START_LINUX.sh
3) Open: http://127.0.0.1:8010/web/

Notes
- Do not open web/index.html directly via file://
- Always run via local HTTP server (scripts above do this)
EOF

cat > "${PKG_DIR}/START_WINDOWS.bat" <<'EOF'
@echo off
cd /d %~dp0
set PORT=8010
set URL=http://127.0.0.1:%PORT%/web/

echo [INFO] Checking Python...
where py >nul 2>nul
if %ERRORLEVEL%==0 (
    set RUN_CMD=py -3 -m http.server %PORT% --bind 127.0.0.1
) else (
  where python >nul 2>nul
  if %ERRORLEVEL%==0 (
    set RUN_CMD=python -m http.server %PORT% --bind 127.0.0.1
  ) else (
    echo [ERROR] Python not found.
    echo Please install Python 3, then run this file again.
    pause
    exit /b 1
  )
)

echo [INFO] Starting local server on %PORT% ...
start "" cmd /c "%RUN_CMD%"

echo [INFO] Waiting server startup...
timeout /t 2 /nobreak >nul

echo [INFO] Opening browser: %URL%
start "" "%URL%"
echo [INFO] If page is blank, press Ctrl+F5 once.
EOF

cat > "${PKG_DIR}/START_LINUX.sh" <<'EOF'
#!/usr/bin/env bash
set -e
cd "$(dirname "$0")"
echo "Starting local server at http://127.0.0.1:8010/web/"
python3 -m http.server 8010 --bind 127.0.0.1
EOF
chmod +x "${PKG_DIR}/START_LINUX.sh"

echo "[4/5] Create zip..."
rm -f "${ZIP_PATH}"
(
  cd "${EXPORT_DIR}"
  zip -qr "${PKG_NAME}.zip" "${PKG_NAME}"
)

echo "[5/5] Done."
echo "Package folder: ${PKG_DIR}"
echo "Zip file      : ${ZIP_PATH}"
du -sh "${ZIP_PATH}" | awk '{print "Zip size      : " $1}'
