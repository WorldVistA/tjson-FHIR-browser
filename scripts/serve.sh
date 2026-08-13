#!/usr/bin/env bash
# Serve the static browser from the repo root (needed for ../vendor and ../examples).
# Usage: ./scripts/serve.sh [port]
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
PORT="${1:-8765}"
cd "$ROOT"
echo "Serving $ROOT on http://127.0.0.1:$PORT/web/"
echo "Open: http://127.0.0.1:$PORT/web/?example=1"
exec python3 -m http.server "$PORT" --bind 127.0.0.1
