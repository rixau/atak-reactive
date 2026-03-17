#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"

cd "$ROOT_DIR/sdk"

if [ ! -d "node_modules" ]; then
    echo "==> Installing SDK dependencies..."
    npm install
fi

echo "==> Building @atak-reactive/sdk..."
npm run build

echo "==> SDK built: sdk/dist/"
ls -la dist/
