# iosp-kiosk — Claude Code project briefing

*The registration desk for the IOSP 2026 ATScience workshop (Leiden, October 2026). Split out*
*of `iosp-hacking-stations` on 2026-09-29 so the desk and the station code could be worked on*
*independently — see that repo's own `CLAUDE.md` for the station side (Live Data Streaming,*
*Noizetoyz, station-4-bots). Bounded, one-off workshop deliverable, so this repo gets a*
*CLAUDE.md for orientation but no `.beans/` of its own. Planning and status live in tracker's*
*`tracker-unef` bean*
*(`~/txt/tracker/.beans/tracker-unef--iosp-kioskonboarding-memodog-pds-check-in-youandme.md`)*
*— read that first (not `tracker-vss7`, which is the higher-level workshop-overview bean that*
*just points here). `tracker-unef` is the actual, actively-updated kiosk/onboarding history:*
*the memo.dog PDS (cocoon → tranquil-pds migration), the ticket/voucher system this repo*
*implements, and everything upstream of it.*

---

## What this is

A ticket/voucher system for the registration desk: participants scan one QR code per person
(never one invite code pre-embedded, which would mean handing out 3x more codes than each
person needs), land on a page where they pick **Aster** (the main science PDS) or **memo.dog**
(a temporary walk-up option), and get an invite code assigned from a pool for whichever they
picked. Aster goes into a real OAuth `prompt=create` signup; memo.dog goes into a direct
account-creation form. Both write a `style.tilde.hacking.checkin` record automatically on real
signup — there's no manual staff check-in step; who's actually joined is just observed via
HappyView/`iosp-hacking-stations/landing-page/viewer.html` directly.

Confirmed working with a real signup, not just designed and deployed: created a live
`@torsten.aster.id` account through the actual flow on 2026-09-29, verified the checkin record
landed on its own repo. See `README.md` for the file-by-file breakdown, `DEPLOY.md` for the
manual deploy steps, `OPS.md` for the PDS ops side (rate limits, backend switching,
troubleshooting), and `tracker-unef` for the full narrative including two real bugs found and
fixed via that live test (a stray unused OAuth redirect_uri, a trailing-slash handle-lookup bug).

`worker/` is a small Cloudflare Worker + D1 database — the only backend that exists. It never
creates PDS accounts itself; it only ever hands out one already-existing invite code per ticket.
`public/` is the whole deployed site (Cloudflare Pages, `kiosk.tilde.style`) — nothing outside
`public/` is ever served, deliberately (an earlier `wrangler pages deploy .` mistake in the sibling
`toons` project published its whole source tree publicly; this repo was structured to avoid that
from day one).

## Do not relitigate

- **This repo has no `.beans/`.** Status lives in tracker's `tracker-unef` (kiosk-specific) and
  `tracker-vss7` (workshop overview, points here) — don't create beans here, don't duplicate
  status here.
- **This repo is public on GitHub** (`ATProto-Science/iosp-kiosk`). Never commit invite codes,
  the `ADMIN_TOKEN`, or the desk QR images that would encode a real one — `*.local.html` and
  `assets/desk-qr.*` are gitignored on purpose. A code once leaked into this repo's history
  can't be revoked after the fact (confirmed the hard way in the pre-split repo — see
  `tracker-unef`) — describe values in commit messages, never quote them.
- **`/staff` will never be an OAuth `redirect_uri` again.** It was a leftover from before the
  ticket flow existed (staff.html doesn't use OAuth — it's a plain `ADMIN_TOKEN` bearer scheme),
  and having it sit unused in `client-metadata.json` caused a real production bug: the browser
  OAuth library silently defaulted to it instead of `/welcome`, permanently losing a real
  session (an authorization code is bound server-side to whichever redirect_uri requested it —
  not fixable after the fact). `oauth.js` now always passes `redirect_uri` explicitly too, as a
  second layer, but don't add a second redirect URI back without a real reason.
- **Local commits only, same as tracker** — don't push without an explicit go-ahead each time,
  even mid-session.
- **Never test against the live invite-code pool with anything but throwaway tickets you
  immediately account for.** A "dry run" once accidentally consumed a real memo.dog code instead
  of a fake test one, because the claim logic picks the oldest available code regardless of
  real-vs-test (see `tracker-unef`, 2026-09-29 entry). Check `/api/admin/stats` is what you
  expect before adding test data to the live pool, or just use `worker/test.sh` against a local
  `wrangler dev` instead — that's what it's for.

## Key relationships

| Project | Path | Role |
|---|---|---|
| tracker | `~/txt/tracker/` | `tracker-unef` (kiosk detail) + `tracker-vss7` (workshop overview) — this repo is code only |
| iosp-hacking-stations | `~/src/iosp-hacking-stations/` | Sibling repo, split from the same origin 2026-09-29 — station code (Live Data Streaming, Noizetoyz, station-4-bots), plus the shared `style.tilde.hacking.*` lexicons and `landing-page/viewer.html` (reads this repo's checkin records) |
| werk.museum | `~/werk.museum/` | Hosts HappyView, which indexes the `style.tilde.hacking.checkin` records this repo's signups write |
