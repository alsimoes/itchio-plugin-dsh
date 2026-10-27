#!/usr/bin/env bash
# Checks the itch.io Plugin environment (butler and credentials).

echo "Checking the itch.io Plugin environment..."
echo ""

if [ -n "${BUTLER_PATH:-}" ] && [ -x "$BUTLER_PATH" ]; then
  echo "OK    butler: $BUTLER_PATH"
  "$BUTLER_PATH" --version
elif command -v butler >/dev/null 2>&1; then
  echo "OK    butler: $(command -v butler)"
  butler --version
else
  echo "WARN  butler not found. Install the itch.io desktop app or set BUTLER_PATH."
fi

if [ -f "$HOME/.config/itch/butler_creds" ]; then
  echo "OK    butler credentials found"
else
  echo "WARN  no butler credentials. Run: butler login"
fi

echo ""
echo "Run a release with (PowerShell):"
echo "  ./release.ps1 -Source ./dist -Target youruser/yourgame -Channel windows -Version 1.0.0"
