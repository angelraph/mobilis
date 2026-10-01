#!/bin/sh
# Runs the public demo ledger in a container: starts a fresh ledger with the
# demo's starting state, and every RESET_HOURS stops it and starts a clean
# one, so a shared public demo never stays in someone else's half-finished
# state for long. Used by the Dockerfile; locally, use demo-ledger.sh.
set -u

cd "$(dirname "$0")/.."
HOURS="${RESET_HOURS:-6}"

while true; do
  echo "Starting a fresh demo ledger (resets every ${HOURS}h)"
  # The image already built the DAR; skip straight to starting it.
  SKIP_BUILD=1 timeout "$((HOURS * 3600))" sh scripts/demo-ledger.sh
  echo "Resetting the demo ledger"
  # Make sure no JVM from the previous run still holds the ports.
  for p in /proc/[0-9]*; do
    if grep -qE "java|serve-ui" "$p/cmdline" 2>/dev/null; then kill "${p#/proc/}" 2>/dev/null || true; fi
  done
  sleep 5
done
