#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXAMPLE_DIR="$(dirname "$SCRIPT_DIR")"

echo "==> Setting up adb reverse port forwarding..."
if adb reverse tcp:5173 tcp:5173 2>/dev/null; then
    echo "    Port 5173 forwarded to device"
else
    echo "    WARNING: adb reverse failed. Is a device connected?"
fi

echo "==> Starting Vite dev server..."
cd "$EXAMPLE_DIR/web"

if [ ! -d "node_modules" ]; then
    echo "==> Installing dependencies..."
    npm install
fi

exec npm run dev
