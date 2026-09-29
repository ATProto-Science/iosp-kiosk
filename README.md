# iosp-kiosk

Registration desk for the IOSP 2026 ATScience workshop (Leiden). Split out of
[`iosp-hacking-stations`](https://github.com/ATProto-Science/iosp-hacking-stations) so the
desk and the station code can be worked on independently.

Deployed as its own Cloudflare Pages project at `kiosk.tilde.style` (no git-integration
deploy — `wrangler pages deploy public`; only `public/` is ever served). The ticket API is a
separate Worker in `worker/` on the route `kiosk.tilde.style/api/*`. See `DEPLOY.md`.

- `public/index.html` — one-page account-creation form (currently memo.dog only); `?invite=` pre-fills the code.
- `public/staff.html` — password-protected check-in console (`/staff`).
- `public/ticket.html`, `oauth.js`, `welcome.html` — ticket page (`/t/ABCD`), browser OAuth client, callback.
- `worker/` — ticket → invite-code API (Cloudflare Worker + D1). `tools/` — OAuth probe.
- `public/client-metadata.json` — OAuth client metadata.
- `OPS.md` — how the PDS backing it runs, rate limits, troubleshooting.
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
