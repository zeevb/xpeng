#!/usr/bin/env bash

set -euo pipefail
umask 077

REPO_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
NVM_BIN="/home/zeev/.config/nvm/versions/node/v24.12.0/bin"
PWCLI="/home/zeev/.codex/skills/playwright/scripts/playwright_cli.sh"
SESSION="whatsapp-xpeng-export"
GENERATED_BROWSER="$REPO_DIR/output/playwright/export-whatsapp-xpeng.generated.browser.js"

if [[ "${1:-}" == "--help" || "${1:-}" == "-h" ]]; then
  echo "Usage: bash scripts/export-whatsapp-xpeng.sh"
  echo
  echo "Opens WhatsApp Web, reuses the persistent login in output/playwright/,"
  echo "and exports the configured XPeng groups to:"
  echo "  raw-data/exports/xpeng_whatsapp_export-<run timestamp>.json"
  exit 0
fi

export PATH="$NVM_BIN:$PATH"
export NPM_CONFIG_CACHE="$REPO_DIR/.npm-cache"
export TZ="Asia/Jerusalem"

mkdir -p "$REPO_DIR/output/playwright" "$REPO_DIR/raw-data/exports"

preserve_checkpoint() {
  local latest
  latest="$(find "$REPO_DIR/output/playwright" -maxdepth 1 -type f \
    \( -name 'xpeng_whatsapp_export-*.json' -o -name 'xpeng-whatsapp-export-*.json' \) -newer "$GENERATED_BROWSER" \
    -printf '%T@ %p\n' 2>/dev/null | sort -n | tail -1 | cut -d' ' -f2-)"
  if [[ -n "$latest" && -f "$latest" ]]; then
    local filename
    filename="$(basename "$latest")"
    filename="${filename/#xpeng-whatsapp-export-/xpeng_whatsapp_export-}"
    cp "$latest" "$REPO_DIR/raw-data/exports/$filename"
  fi
}

cleanup() {
  cd "$REPO_DIR"
  preserve_checkpoint || true
  bash "$PWCLI" --session "$SESSION" close >/dev/null 2>&1 || true
}
trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

cd "$REPO_DIR"

echo "Incremental cutoffs derived from existing raw-data exports:"
node scripts/prepare-whatsapp-incremental.cjs \
  "$REPO_DIR" \
  "$REPO_DIR/scripts/export-whatsapp-xpeng.browser.js" \
  "$GENERATED_BROWSER"

# A prior interrupted export may have left the named browser daemon alive.
bash "$PWCLI" --session "$SESSION" close >/dev/null 2>&1 || true
# The exploratory browser session uses the same persistent WhatsApp profile.
bash "$PWCLI" --session whatsapp close >/dev/null 2>&1 || true

run_browser() {
timeout --signal=TERM --kill-after=10s 3m bash "$PWCLI" \
  --session "$SESSION" \
  open https://web.whatsapp.com \
  --headed \
  --config scripts/whatsapp-playwright.config.json || return $?

# Keep the daemon active while WhatsApp restores and may replace its page.
# Each snapshot reacquires the current page before extraction begins.
for _ in 1 2 3 4 5 6; do
  sleep 5
  timeout --signal=TERM --kill-after=5s 20s bash "$PWCLI" \
    --session "$SESSION" \
    snapshot >/dev/null || return $?
done

timeout --signal=TERM --kill-after=10s 18m bash "$PWCLI" \
  --session "$SESSION" \
  run-code \
  --filename "$GENERATED_BROWSER"
}

export_status=1
for attempt in 1 2 3; do
  if run_browser; then
    export_status=0
    break
  else
    export_status=$?
  fi
  preserve_checkpoint || true
  bash "$PWCLI" --session "$SESSION" close >/dev/null 2>&1 || true
  if [[ "$attempt" -lt 3 ]]; then
    echo "Browser attempt $attempt failed (exit $export_status); checkpoint retained, retrying."
    # Retain the original cutoff during retries: a partial attempt must not
    # advance it, and same-run overlap is preferable to missing messages.
  fi
done
if [[ "$export_status" -ne 0 ]]; then
  echo "Export failed after three browser attempts; available checkpoints were preserved." >&2
  exit "$export_status"
fi

preserve_checkpoint

echo
echo "See the result above for the timestamped checkpoint path and each group's status."
echo "Partial files require review; browser history is not proof of full phone history."
