#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"

PORT="${1:-8765}"
python3 -m http.server "$PORT" --bind 127.0.0.1
