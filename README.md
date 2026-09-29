# iosp-kiosk

Registration desk for the IOSP 2026 ATScience workshop (Leiden). Split out of
[`iosp-hacking-stations`](https://github.com/ATProto-Science/iosp-hacking-stations) so the
desk and the station code can be worked on independently.

Deployed as its own Cloudflare Pages project at `kiosk.tilde.style` (no git-integration
deploy — `wrangler pages deploy public`; only `public/` is ever served). The ticket API is a
separate Worker in `worker/` on the route `kiosk.tilde.style/api/*`. See `DEPLOY.md`.

- `public/ticket.html`, `oauth.js`, `welcome.html` — ticket page (`/t/ABCD`, the actual entry
  point: participant picks Aster or memo.dog), browser OAuth client, Aster signup callback.
- `public/index.html` — memo.dog's own account-creation form; `?invite=` pre-fills the code
  (reached via the ticket page's memo.dog choice, or directly as the walk-up path).
- `public/staff.html` — password-protected invite-desk admin (`/staff`): ticket/code stats,
  paste in codes minted elsewhere, mint more tickets. No longer a check-in console — real
  memo.dog/Aster signups are visible via HappyView directly, no manual staff step needed.
- `public/client-metadata.json` — OAuth client metadata.
- `worker/` — ticket → invite-code API (Cloudflare Worker + D1); `schema.sql`, `wrangler.jsonc`.
- `tools/` — `make-tickets.mjs` (mint tickets, print the QR sheet), `mint-memo-codes.mjs` (mint a
  memo.dog invite code straight from the PDS into the ticket API), `test-create-prompt.mjs`
  (read-only OAuth `prompt=create` probe against any PDS).
- `OPS.md` — how the PDS backing it runs, rate limits, troubleshooting.
- `DEPLOY.md` — the manual deploy steps, in order.
- `docs/` — upstream bug write-ups (youandme.at, cocoon).

## Not in this repo

- **Invite codes and desk QR images** — never committed (public repo). `assets/desk-qr.*` and
  `*.local.html` are gitignored. Mint codes on the PDS; generate QR sheets locally.
- The `style.tilde.hacking.*` lexicons and `site.css` live in `iosp-hacking-stations/landing-page/`
  (shared with `viewer.html`); the kiosk links to `hacking.tilde.style/site.css`.

## Ticket flow

QR encodes `kiosk.tilde.style/t/<4-char id>` → participant picks Aster (main) or memo.dog
(temporary) → the Worker hands out one invite code → Aster: OAuth with `prompt=create`;
memo.dog: the existing form.
