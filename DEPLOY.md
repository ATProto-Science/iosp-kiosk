# Deploying the ticket flow

Nothing here is automated; run each step by hand. Never put invite codes or `ADMIN_TOKEN` in a
commit, a shell history you share, or a file inside this repo.

## 0. Before touching anything live

Live `kiosk.tilde.style` currently serves the old pages (identical to the pre-split
`index.html`, `staff.html`, `client-metadata.json`). The first deploy from `public/` adds the
ticket pages and the `/welcome` redirect URI, and stops serving `OPS.md`. Nothing else changes.

## 1. Worker + database (`worker/`)

```sh
cd worker && npm install
npx wrangler d1 create iosp-kiosk                 # copy the printed database_id into wrangler.jsonc
npx wrangler d1 execute iosp-kiosk --remote --file schema.sql
npx wrangler secret put ADMIN_TOKEN               # paste a long random value (openssl rand -hex 32)
```
Add the route to `wrangler.jsonc` (zone must be the one holding tilde.style):
```jsonc
"routes": [{ "pattern": "kiosk.tilde.style/api/*", "zone_name": "tilde.style" }]
```
```sh
npx wrangler deploy
curl -s https://kiosk.tilde.style/api/ticket/ZZZZ     # expect {"error":"unknown ticket"} (JSON, not HTML)
```
If that returns HTML, the Pages site is answering instead of the Worker: check the route.
(Worker-route-over-Pages-domain precedence has not been tested for this project.)

## 2. Site (`public/`)

```sh
npx wrangler pages deploy public --project-name kiosk-tilde-style
```
Roll back from the Cloudflare dashboard (Pages → kiosk-tilde-style → Deployments → previous → Rollback).
Verify: `/`, `/staff`, `/t/ZZZZ` (shows "we don't recognise this ticket"), `/OPS.md` now 404/HTML fallback.

## 3. Load codes and mint tickets

```sh
T=<the ADMIN_TOKEN>; A=https://kiosk.tilde.style/api/admin
# Aster: single-use codes, one per line in a file OUTSIDE the repo
jq -Rn '[inputs]|{pds:"aster",maxUses:1,codes:.}' < ~/aster-codes.txt \
  | curl -s -X POST -H "authorization: Bearer $T" -H 'content-type: application/json' -d @- $A/codes
# memo.dog: a few multi-use codes (mint fresh ones on haensel; do not reuse the leaked one)
curl -s -X POST -H "authorization: Bearer $T" -H 'content-type: application/json' \
  -d '{"pds":"memo","maxUses":50,"codes":["<code>"]}' $A/codes
# ~50 tickets (+ spares)
curl -s -X POST -H "authorization: Bearer $T" -H 'content-type: application/json' -d '{"count":60}' $A/tickets
curl -s -H "authorization: Bearer $T" $A/stats
```

## 4. Test end to end once, with a spare Aster code

Claim a ticket at `/t/<id>` → Aster → Continue → check the signup form appears, paste the code,
finish, land on `/welcome`. This round trip has NOT been tested yet.
