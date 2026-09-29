// Browser OAuth client for the ticket flow: sends a participant to their new PDS's own
// signup screen (prompt=create) and picks the session back up at /welcome.
// Public client, near-minimal scope: `atproto` (identity) plus create-only access to the
// one collection welcome.html writes a check-in record to (so the viewer/toon board can
// see Aster signups the same way they already see memo.dog's, without a staff console).
import { BrowserOAuthClient } from "https://esm.sh/@atproto/oauth-client-browser@0.5.8";

const SIGNUP_SCOPE = "atproto repo:style.tilde.hacking.checkin?action=create";

let clientPromise = null;
export function getClient() {
  if (!clientPromise) {
    clientPromise = BrowserOAuthClient.load({
      clientId: "https://kiosk.tilde.style/client-metadata.json",
      handleResolver: "https://bsky.social", // unused for PDS-URL sign-in, required by the constructor
    });
  }
  return clientPromise;
}

// Never returns: navigates the browser to the PDS. `state` round-trips the ticket id.
//
// UNTESTED as of 2026-09-29: the working, screenshot-confirmed signup flow used scope
// "atproto" alone. Adding the repo: scope here is believed correct (mirrors atmoquest's
// own least-privilege pattern for a granular-scope PDS) but hasn't been run against a
// real aster.id signup yet — do that with the next spare invite code, checking both that
// signup still completes AND that welcome.html's check-in write actually succeeds.
export async function startSignup(pdsUrl, ticketId) {
  const client = await getClient();
  await client.signIn(pdsUrl, { prompt: "create", scope: SIGNUP_SCOPE, state: ticketId });
}

export async function restoreSession() {
  const client = await getClient();
  const result = await client.init();
  return result ? { session: result.session, state: result.state } : null;
}
