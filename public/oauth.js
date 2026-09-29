// Browser OAuth client for the ticket flow: sends a participant to their new PDS's own
// signup screen (prompt=create) and picks the session back up at /welcome.
// Public client, minimal scope: we only need the account to exist, not to write anything.
import { BrowserOAuthClient } from "https://esm.sh/@atproto/oauth-client-browser@0.5.8";

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
export async function startSignup(pdsUrl, ticketId) {
  const client = await getClient();
  await client.signIn(pdsUrl, { prompt: "create", scope: "atproto", state: ticketId });
}

export async function restoreSession() {
  const client = await getClient();
  const result = await client.init();
  return result ? { session: result.session, state: result.state } : null;
}
