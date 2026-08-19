#!/usr/bin/env bash
# Checkpoint 01 VPS acceptance — TMUX-safe. Does not call DataForSEO, Places, or GSC.
# Does not publish, index, or restart production PM2.
set -euo pipefail
COMMIT="${1:-REPLACE_COMMIT_SHA}"
LOG=/tmp/pharmaconnect-checkpoint-01.log
WORKSPACE=/home/inboxingproweb/pharmaconnect-growth-engine
RECOVERY=/home/inboxingproweb/recovery/pharmaconnect-gp01c-validation
PORT="${PORT:-4318}"
exec > >(tee -a "$LOG") 2>&1
echo "CHECKPOINT_01_START $(date -u +%Y-%m-%dT%H:%M:%SZ) commit=$COMMIT"
mkdir -p "$RECOVERY"
cd "$RECOVERY"
if [ ! -d .git ]; then
  git clone "$WORKSPACE" .
fi
set +e
# shellcheck disable=SC1091
[ -f "$WORKSPACE/.env" ] && set -a && . "$WORKSPACE/.env" && set +a
set -e
export WORKSPACE_ROOT="$WORKSPACE"
export PORT
git fetch origin cursor/gp01c-national-local-growth-plan-routing-ac7f
git checkout --force "$COMMIT"
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile || pnpm install
pnpm --filter ./artifacts/api-server run build
npx tsx scripts/validate-national-business-intelligence-checkpoint-01.ts
npx tsx scripts/browser-national-business-intelligence-checkpoint-01.ts
echo "BROWSER_URL=http://127.0.0.1:${PORT}/api/growth-engine/business-intelligence?slug=pharmaconnect"
echo "WEBSITE_URL=http://127.0.0.1:${PORT}/api/growth-engine/website-intelligence?slug=pharmaconnect"
echo "CHECKPOINT_01_VALIDATION_DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Starting isolated browser server on ${PORT} (not production PM2)"
exec env PORT="$PORT" HOST=127.0.0.1 WORKSPACE_ROOT="$WORKSPACE" npx tsx scripts/checkpoint-01-isolated-browser-server.ts
