#!/bin/bash
# Starts Xvfb virtual display and launches Chromium with the Claude Code extension.
# Usage: bash docker/start-claude-chrome.sh [URL]

DISPLAY_NUM="${DISPLAY_NUM:-99}"
EXTENSION_DIR="$HOME/.chrome-extensions/fcoeoabgfenejglbffodgkkbkcdhcgfn"

if [ ! -f "$EXTENSION_DIR/manifest.json" ]; then
  echo "ERROR: Claude extension not found at $EXTENSION_DIR"
  echo "Run 'bash docker/setup-claude-chrome.sh' first."
  exit 1
fi

# Start Xvfb virtual display if not already running
if ! pgrep -x Xvfb > /dev/null; then
  Xvfb ":${DISPLAY_NUM}" -screen 0 1920x1080x24 &
  sleep 1
  echo "Started Xvfb on :${DISPLAY_NUM}"
fi

export DISPLAY=":${DISPLAY_NUM}"

echo "Launching Chromium with Claude extension..."
echo "Remote debugging available at http://localhost:9222"

exec chromium-browser \
  --no-sandbox \
  --disable-dev-shm-usage \
  --disable-gpu \
  --load-extension="${EXTENSION_DIR}" \
  --enable-extensions \
  --remote-debugging-port=9222 \
  --user-data-dir="/tmp/chromium-claude-profile" \
  "$@"
