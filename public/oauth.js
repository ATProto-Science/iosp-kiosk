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
// `redirect_uri` MUST be explicit: client-metadata.json lists two redirect_uris (/staff,
// /welcome — /staff predates this flow, kept for the invite-desk admin page's own possible
// future OAuth use), and the library silently defaults to redirect_uris[0] if not told
// otherwise. Confirmed live 2026-09-29: a real signup came back on /staff instead of
// /welcome because of exactly this, losing the callback (recoverable only by hand-editing
// the returned URL's path before the auth code expired).
export async function startSignup(pdsUrl, ticketId) {
  const client = await getClient();
  await client.signIn(pdsUrl, {
    prompt: "create",
    scope: SIGNUP_SCOPE,
    state: ticketId,
    redirect_uri: "https://kiosk.tilde.style/welcome",
  });
}

export async function restoreSession() {
  const client = await getClient();
  const result = await client.init();
  return result ? { session: result.session, state: result.state } : null;
}
