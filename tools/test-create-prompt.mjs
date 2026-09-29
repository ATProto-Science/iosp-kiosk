// Probe: does a PDS's OAuth authorize page honour prompt=create (open signup)?
//
//   node test-create-prompt.mjs https://aster.id
//
// Read-only: does the PAR + DPoP + PKCE handshake, then PRINTS the authorize URL
// and exits. It never starts a callback listener and never submits a signup, so
// no invite code is consumed. Open the URL in a browser and check by eye that the
// signup form (with an invite-code field) appears; close the tab without submitting.
//
// Uses a loopback client (client_id http://localhost) so it doesn't depend on the
// deployed client-metadata.json's redirect_uris. Pattern borrowed from haiku.garden/oauth.js.

import { NodeOAuthClient } from '@atproto/oauth-client-node';

const pds = process.argv[2];
if (!pds) {
	console.error('usage: node test-create-prompt.mjs <pds-url>');
	process.exit(1);
}

const redirect = 'http://127.0.0.1:8765/callback';
const scope = 'atproto transition:generic';
const map = () => {
	const m = new Map();
	return { set: async (k, v) => void m.set(k, v), get: async (k) => m.get(k), del: async (k) => void m.delete(k) };
};

const client = new NodeOAuthClient({
	clientMetadata: {
		client_id: `http://localhost?redirect_uri=${encodeURIComponent(redirect)}&scope=${encodeURIComponent(scope)}`,
		redirect_uris: [redirect],
		scope,
		grant_types: ['authorization_code'],
		response_types: ['code'],
		application_type: 'web',
		token_endpoint_auth_method: 'none',
		dpop_bound_access_tokens: true
	},
	stateStore: map(),
	sessionStore: map()
});

const url = await client.authorize(pds, { prompt: 'create' });
console.log('authorize URL (prompt=create):\n' + url);
console.log('\n(prompt=create travels in the PAR body, so it is not visible in this URL.)');
