# iosp-kiosk

Registration desk for the IOSP 2026 ATScience workshop (Leiden). Split out of
[`iosp-hacking-stations`](https://github.com/ATProto-Science/iosp-hacking-stations) so the
desk and the station code can be worked on independently.

Deployed as its own Cloudflare Pages project at `kiosk.tilde.style` (no git-integration
deploy — `wrangler pages deploy .`).

- `index.html` — one-page account-creation form (currently memo.dog only); `?invite=` pre-fills the code.
- `staff.html` — password-protected check-in console (`/staff`).
- `client-metadata.json` — OAuth client metadata.
- `OPS.md` — how the PDS backing it runs, rate limits, troubleshooting.
- `docs/` — upstream bug write-ups (youandme.at, cocoon).

## Not in this repo

- **Invite codes and desk QR images** — never committed (public repo). `assets/desk-qr.*` and
  `*.local.html` are gitignored. Mint codes on the PDS; generate QR sheets locally.
- The `style.tilde.hacking.*` lexicons and `site.css` live in `iosp-hacking-stations/landing-page/`
  (shared with `viewer.html`); the kiosk links to `hacking.tilde.style/site.css`.

## Planned

Ticket flow: QR encodes a short ticket ID → participant chooses a PDS → invite code is assigned
server-side (`create=prompt`; needs testing against Aster's PDS).
