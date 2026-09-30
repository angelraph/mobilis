#!/bin/sh
# Starts a fresh local ledger for a live or recorded demo: sandbox, the
# Setup:demoStart script (parties + an empty agreement), and the JSON API
# serving the UI at http://localhost:7575/ui/. Unlike `daml start`, this
# does NOT run the full Setup:setup scenario, so every step can be shown
# through the UI. Stop it with Ctrl+C.
#
#   scripts/demo-ledger.sh
#
set -eu

cd "$(dirname "$0")/.."
ROOT=$(pwd)

(cd daml && daml build)
scripts/generate-config.sh

DAR="$ROOT/daml/.daml/dist/mobilis-0.1.0.dar"
UI_DIR="$ROOT/ui"
# The JSON API wants a native path on Windows.
if command -v cygpath >/dev/null 2>&1; then UI_DIR=$(cygpath -w "$UI_DIR"); fi

daml sandbox --port 6865 --dar "$DAR" &
SANDBOX=$!
trap 'kill $SANDBOX $JSONAPI 2>/dev/null' EXIT INT TERM
JSONAPI=""

# Wait until the ledger answers, then create the demo's starting state
# exactly once (retrying the script itself would re-allocate parties that
# a half-finished first attempt already created).
until daml ledger list-parties --host localhost --port 6865 >/dev/null 2>&1; do
  sleep 2
done
daml script --dar "$DAR" --script-name Setup:demoStart --ledger-host localhost --ledger-port 6865

daml json-api --ledger-host localhost --ledger-port 6865 --http-port 7575 \
  --allow-insecure-tokens --static-content "prefix=ui,directory=$UI_DIR" &
JSONAPI=$!

echo "Demo ledger ready: http://localhost:7575/ui/demo-wall.html"
wait $SANDBOX
