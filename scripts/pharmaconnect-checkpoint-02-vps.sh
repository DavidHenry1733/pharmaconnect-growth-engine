#!/usr/bin/env bash
# Checkpoint 02 VPS acceptance — TMUX-safe.
# Does not publish, index, restart production PM2, or expand competitor ranked keywords.
set -euo pipefail
COMMIT="${1:-REPLACE_COMMIT_SHA}"
LOG=/tmp/pharmaconnect-checkpoint-02.log
WORKSPACE=/home/inboxingproweb/pharmaconnect-growth-engine
RECOVERY=/home/inboxingproweb/recovery/pharmaconnect-gp01c-validation
PORT="${PORT:-4319}"
exec > >(tee -a "$LOG") 2>&1
echo "CHECKPOINT_02_START $(date -u +%Y-%m-%dT%H:%M:%SZ) commit=$COMMIT"
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
echo "Validators restore any fixture competitor-discovery snapshot; they do not promote fixtures into production data."
npx tsx scripts/validate-checkpoint-02-commercial-competitor-discovery.ts
npx tsx scripts/validate-national-search-commercial-gate-v1.ts
npx tsx scripts/validate-national-competitor-discovery-v1.ts
npx tsx scripts/validate-growth-plan-platform-routing-v1.ts
npx tsx scripts/browser-checkpoint-02-commercial-competitor-discovery.ts
npx tsx scripts/run-checkpoint-02-commercial-discovery.ts pharmaconnect
if [ "${CHECKPOINT_02_LIVE:-0}" = "1" ]; then
  echo "ONE bounded live commercial competitor discovery run (SERP discovery evidence only; ranked-keyword expansion remains 0)"
  npx tsx scripts/run-checkpoint-02-commercial-discovery.ts pharmaconnect --live
  echo "REAL_DISCOVERY printed above. Browser acceptance is a later step after this live run."
fi
echo "BROWSER_URL=http://127.0.0.1:${PORT}/api/growth-engine/search-intelligence?slug=pharmaconnect"
echo "CHECKPOINT_02_VALIDATION_DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Starting isolated browser server on ${PORT} (not production PM2)"
exec env PORT="$PORT" HOST=127.0.0.1 WORKSPACE_ROOT="$WORKSPACE" npx tsx scripts/checkpoint-01-isolated-browser-server.ts
