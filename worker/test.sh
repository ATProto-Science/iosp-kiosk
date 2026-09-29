#!/usr/bin/env bash
# Runs test.mjs against a fresh local D1 + wrangler dev instance, then tears everything down.
# The whole point: `./test.sh` is the one command to actually exercise worker/src/index.js
# locally — no manual "reset db, start dev, wait, run tests, kill it" dance needed.
set -euo pipefail
cd "$(dirname "$0")"

rm -rf .state
npx wrangler d1 execute iosp-kiosk --local --persist-to .state --file schema.sql >/dev/null 2>&1

npx wrangler dev --local --persist-to .state --port 8787 >/tmp/iosp-kiosk-test-wrangler.log 2>&1 &
DEV_PID=$!
# wrangler dev spawns a workerd child that survives killing the wrapper process alone
# (confirmed the hard way testing this project) — kill by port instead, to be sure.
cleanup() {
  kill "$DEV_PID" 2>/dev/null || true
  local pid; pid=$(ss -ltnp 2>/dev/null | grep ':8787' | grep -o 'pid=[0-9]*' | cut -d= -f2)
  [ -n "$pid" ] && kill "$pid" 2>/dev/null
  rm -rf .state
}
trap cleanup EXIT

for i in $(seq 1 40); do
  curl -s -o /dev/null http://127.0.0.1:8787/api/x && break
  sleep 1
done

node test.mjs
