#!/usr/bin/env bash
# Qualify already-persisted real Checkpoint 02 candidates.
# Does not run SERP discovery, DataForSEO, ranked-keyword expansion, Places, or GSC.
set -euo pipefail
COMMIT="${1:-REPLACE_COMMIT_SHA}"
LOG=/tmp/pharmaconnect-checkpoint-02-qualify-persisted.log
WORKSPACE=/home/inboxingproweb/pharmaconnect-growth-engine
PORT="${PORT:-4319}"
exec > >(tee -a "$LOG") 2>&1
echo "CHECKPOINT_02_QUALIFY_PERSISTED_START $(date -u +%Y-%m-%dT%H:%M:%SZ) commit=$COMMIT"
cd "$WORKSPACE"
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
echo "QUALIFYING EXISTING REAL SNAPSHOT — no SERP discovery, no DataForSEO, no ranked keywords"
npx tsx scripts/run-checkpoint-02-commercial-discovery.ts pharmaconnect --requalify-persisted
echo "DATAFORSEO_CALLS=0"
echo "GOOGLE_PLACES_CALLS=0"
echo "GSC_CALLS=0"
echo "COMPETITOR_RANKED_KEYWORD_REQUESTS=0"
echo "BROWSER_URL=http://127.0.0.1:${PORT}/api/growth-engine/search-intelligence?slug=pharmaconnect"
echo "CHECKPOINT_02_QUALIFY_PERSISTED_DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Starting isolated browser server on ${PORT} (not production PM2)"
exec env PORT="$PORT" HOST=127.0.0.1 WORKSPACE_ROOT="$WORKSPACE" npx tsx scripts/checkpoint-01-isolated-browser-server.ts
