# IOSP open-web site

Static site in `public/`; deploy via GitHub Pages, publishing only that directory. Repo name `iosp-kiosk` is historical. See `README.md` for the RSVP/Airglow/list flow and `DEPLOY.md` for origin-dependent OAuth setup.

No Worker, invite codes, ticketing, or `style.tilde.hacking.checkin` records are part of this flow. Do not put an atproto.science credential or an invite code in browser code or this public repository. The existing `kiosk.tilde.style` deployment does not disappear when these files change.

An existing account uses browser OAuth; a new account uses the open temporary PDS and its returned access token. Both write an RSVP to the attendee's own repo. Test with a test event and list before enabling Airglow against the real conference list. Leave event URI/CID unset until supplied. Do not claim list membership immediately after writing an RSVP; Airglow is asynchronous.
