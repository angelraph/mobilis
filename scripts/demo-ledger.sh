#!/bin/sh
# Starts a fresh local Canton 3.x ledger for a live or recorded demo: the
# sandbox (with the JSON Ledger API v2 on an internal port), the
# Setup:demoStart script (parties + an empty agreement), and
# scripts/serve-ui.js, which serves the interface at
# http://localhost:7575/ui/ and forwards ledger calls to the sandbox.
# Unlike Setup:setup, the demo starts empty so every step can be shown
# through the UI. Stop it with Ctrl+C.
#
#   scripts/demo-ledger.sh
#
set -eu

# Find a command on the PATH, or its Windows .cmd shim (Git Bash's POSIX sh
# won't find .cmd files by name), optionally also in a default folder.
find_cmd() {
  name=$1; fallback=${2:-}
  if command -v "$name" >/dev/null 2>&1; then command -v "$name"; return 0; fi
  OLD_IFS=$IFS; IFS=:
  for dir in $PATH $fallback; do
    if [ -f "$dir/$name.cmd" ]; then IFS=$OLD_IFS; echo "$dir/$name.cmd"; return 0; fi
  done
  IFS=$OLD_IFS
  return 1
}

APPDATA_U=""
if [ -n "${APPDATA:-}" ] && command -v cygpath >/dev/null 2>&1; then APPDATA_U=$(cygpath -u "$APPDATA"); fi

if ! DPM=$(find_cmd dpm "${APPDATA_U:+$APPDATA_U/dpm/bin}"); then
  echo "The Canton 3.x SDK (dpm) was not found. Install it first (see docs/RUN-LOCALLY.md), then open a new terminal." >&2
  exit 1
fi
if ! command -v java >/dev/null 2>&1; then
  echo "Java not found. Install a JDK 17 or newer (see docs/RUN-LOCALLY.md), then open a new terminal." >&2
  exit 1
fi
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js not found. Install Node 18 or newer (see docs/RUN-LOCALLY.md), then open a new terminal." >&2
  exit 1
fi

cd "$(dirname "$0")/.."
ROOT=$(pwd)

if [ -z "${SKIP_BUILD:-}" ]; then
  "$DPM" build --all
  sh scripts/generate-config.sh
fi

DAR="$ROOT/daml/.daml/dist/mobilis-0.1.0.dar"
TEST_DAR="$ROOT/daml-test/.daml/dist/mobilis-test-0.1.0.dar"
JSON_PORT="${JSON_API_PORT:-7576}"

PORT_FILE="$ROOT/daml/.daml/sandbox-ports.json"
rm -f "$PORT_FILE"
"$DPM" sandbox --ledger-api-port 6865 --json-api-port "$JSON_PORT" --dar "$DAR" --dar "$TEST_DAR"   --canton-port-file "$(command -v cygpath >/dev/null 2>&1 && cygpath -w "$PORT_FILE" || echo "$PORT_FILE")" &
SANDBOX=$!
UI=""
trap 'kill $SANDBOX $UI 2>/dev/null' EXIT INT TERM

# Wait until the ledger answers, then create the demo's starting state
# exactly once (retrying the script would re-allocate parties that a
# half-finished first attempt already created).
# The port file appears only once the sandbox is fully up (connected to
# its synchronizer); /livez alone answers too early to allocate parties.
until [ -s "$PORT_FILE" ] && curl -sf "http://127.0.0.1:$JSON_PORT/livez" >/dev/null 2>&1; do
  sleep 2
done
"$DPM" script --dar "$TEST_DAR" --script-name Setup:demoStart --ledger-host localhost --ledger-port 6865

# HOST=0.0.0.0 lets a hosted container accept outside traffic; locally it
# stays on 127.0.0.1.
PORT=7575 HOST="${UI_HOST:-127.0.0.1}" JSON_API="http://127.0.0.1:$JSON_PORT" node scripts/serve-ui.js &
UI=$!

echo "Demo ledger ready: http://localhost:7575/ui/demo-wall.html"
wait $SANDBOX
