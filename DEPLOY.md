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
If that returns HTML, wait a minute and retry: route changes took ~1 minute to propagate on
2026-09-29, after which the Worker route did take precedence over the Pages site on this domain.

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
# memo.dog: mint a fresh multi-use code straight from admin.memo.dog into the ticket API
# (never reuse the leaked one). Password is in tkeys as memo-dog-tranquil/admin-password.
cd tools
ADMIN_HANDLE=admin.memo.dog ADMIN_TOKEN=$T \
  PDS_ADMIN_PASSWORD="$(tkeys show memo-dog-tranquil/admin-password | head -1)" \
  node mint-memo-codes.mjs --uses 50
cd ..
curl -s -H "authorization: Bearer $T" $A/stats
```

Mint tickets and print the QR sheet (writes `tools/qr-sheet.local.html`, gitignored; the QR codes
carry only ticket ids, never invite codes):
```sh
cd tools && npm install
ADMIN_TOKEN=$T node make-tickets.mjs --mint 60         # ~50 participants + spares
ADMIN_TOKEN=$T node make-tickets.mjs --unclaimed       # later: reprint whatever is still unused
```
Open the HTML, print on A4, cut along the dashed lines.

## 4. Test end to end once, with a spare Aster code

Claim a ticket at `/t/<id>` → Aster → Continue → check the signup form appears, paste the code,
finish, land on `/welcome`. This round trip has NOT been tested yet.
