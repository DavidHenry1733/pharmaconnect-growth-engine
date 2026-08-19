#!/usr/bin/env bash
# Qualify already-persisted real Checkpoint 02 candidates.
# CODE runs from the recovery checkout. DATA is read from WORKSPACE_ROOT.
# Does not switch the real workspace git branch.
# Does not rediscover competitors, call DataForSEO, Places, or GSC.
set -euo pipefail
COMMIT="${1:-REPLACE_COMMIT_SHA}"
LOG=/tmp/pharmaconnect-checkpoint-02-qualify-persisted.log
CODE_ROOT=/home/inboxingproweb/recovery/pharmaconnect-gp01c-validation
WORKSPACE_ROOT=/home/inboxingproweb/pharmaconnect-growth-engine
GITHUB_URL=https://github.com/DavidHenry1733/pharmaconnect-growth-engine.git
PORT="${PORT:-4319}"
SNAPSHOT="$WORKSPACE_ROOT/data/national-growth-engine/pharmaconnect-competitor-discovery.json"
exec > >(tee -a "$LOG") 2>&1
echo "CHECKPOINT_02_QUALIFY_PERSISTED_START $(date -u +%Y-%m-%dT%H:%M:%SZ) commit=$COMMIT"
echo "CODE_ROOT=$CODE_ROOT"
echo "WORKSPACE_ROOT=$WORKSPACE_ROOT"
echo "GIT_OPERATIONS_ON_WORKSPACE_ROOT=0"

if [ ! -d "$WORKSPACE_ROOT" ]; then
  echo "REFUSED: WORKSPACE_ROOT does not exist: $WORKSPACE_ROOT"
  exit 1
fi
if [ ! -f "$SNAPSHOT" ]; then
  echo "REFUSED: existing real competitor snapshot missing: $SNAPSHOT"
  exit 1
fi

mkdir -p "$CODE_ROOT"
cd "$CODE_ROOT"
if [ ! -d .git ]; then
  git clone "$GITHUB_URL" .
fi

# Recovery git only. Never fetch/checkout inside WORKSPACE_ROOT.
if [ "$(git rev-parse HEAD)" != "$COMMIT" ]; then
  git fetch "$GITHUB_URL" "+refs/heads/cursor/gp01c-national-local-growth-plan-routing-ac7f:refs/remotes/github-cursor/gp01c"
  git checkout --force "$COMMIT"
fi
ACTUAL="$(git rev-parse HEAD)"
if [ "$ACTUAL" != "$COMMIT" ]; then
  echo "REFUSED: recovery checkout HEAD=$ACTUAL expected=$COMMIT"
  exit 1
fi
echo "RECOVERY_HEAD=$ACTUAL"

set +e
# shellcheck disable=SC1091
[ -f "$WORKSPACE_ROOT/.env" ] && set -a && . "$WORKSPACE_ROOT/.env" && set +a
set -e
export WORKSPACE_ROOT
export PORT
export HOST="${HOST:-127.0.0.1}"

corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile || pnpm install

echo "QUALIFYING EXISTING REAL SNAPSHOT at $SNAPSHOT"
echo "NO rediscovery. NO DataForSEO. NO ranked-keyword expansion."
npx tsx scripts/run-checkpoint-02-commercial-discovery.ts pharmaconnect --requalify-persisted
echo "DATAFORSEO_CALLS=0"
echo "GOOGLE_PLACES_CALLS=0"
echo "GSC_CALLS=0"
echo "COMPETITOR_RANKED_KEYWORD_REQUESTS=0"
echo "GIT_OPERATIONS_ON_WORKSPACE_ROOT=0"

echo "BROWSER_HOST=127.0.0.1"
echo "BROWSER_PORT=${PORT}"
echo "PUTTY_TUNNEL=Source port ${PORT} ; Destination 127.0.0.1:${PORT} ; Local"
echo "BROWSER_ACCESS=After the PuTTY local tunnel is open, use a desktop browser on the same machine as PuTTY."
echo "BI_URL=http://127.0.0.1:${PORT}/api/growth-engine/business-intelligence?slug=pharmaconnect"
echo "WI_URL=http://127.0.0.1:${PORT}/api/growth-engine/website-intelligence?slug=pharmaconnect"
echo "BROWSER_URL=http://127.0.0.1:${PORT}/api/growth-engine/search-intelligence?slug=pharmaconnect"
echo "CHECKPOINT_02_QUALIFY_PERSISTED_DONE $(date -u +%Y-%m-%dT%H:%M:%SZ)"
echo "Starting isolated browser server on ${PORT} (not production PM2)"
exec env PORT="$PORT" HOST=127.0.0.1 WORKSPACE_ROOT="$WORKSPACE_ROOT" npx tsx scripts/checkpoint-01-isolated-browser-server.ts
