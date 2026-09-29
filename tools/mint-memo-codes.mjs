// Mint a multi-use memo.dog invite code on the PDS and load it into the ticket service.
// The code is NEVER printed or written to disk: it goes PDS -> memory -> ticket API.
//
//   ADMIN_HANDLE=<pds admin handle> ADMIN_TOKEN=$(cat ~/.config/iosp-kiosk/admin-token) \
//     node mint-memo-codes.mjs [--uses 50] [--codes 1]
//   options: --pds https://memo.dog   --api https://kiosk.tilde.style/api
//
// Prompts for the PDS admin account's password (hidden). Needs a PDS whose
// com.atproto.server.createInviteCode accepts that account (tranquil-pds admin).

import readline from 'node:readline';

const args = process.argv.slice(2);
const opt = (n, d) => { const i = args.indexOf(`--${n}`); return i < 0 ? d : args[i + 1]; };
const PDS = opt('pds', 'https://memo.dog').replace(/\/$/, '');
const API = opt('api', 'https://kiosk.tilde.style/api').replace(/\/$/, '');
const USES = Number(opt('uses', 50));
const COUNT = Number(opt('codes', 1));
const handle = process.env.ADMIN_HANDLE;
const kioskToken = process.env.ADMIN_TOKEN;
if (!handle || !kioskToken) { console.error('set ADMIN_HANDLE and ADMIN_TOKEN in the environment'); process.exit(1); }
if (!(USES >= 1 && COUNT >= 1)) { console.error('--uses and --codes must be >= 1'); process.exit(1); }

function askHidden(q) {
	if (process.env.PDS_ADMIN_PASSWORD) return Promise.resolve(process.env.PDS_ADMIN_PASSWORD); // non-interactive/testing
	return new Promise((resolve) => {
		const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
		rl._writeToOutput = (s) => { if (s.includes(q)) rl.output.write(s); };
		rl.question(q, (a) => { rl.close(); console.log(); resolve(a); });
	});
}

const j = async (url, init) => {
	const r = await fetch(url, init);
	const b = await r.json().catch(() => ({}));
	if (!r.ok) throw new Error(`${new URL(url).pathname}: HTTP ${r.status} ${b.error || ''} ${b.message || ''}`.trim());
	return b;
};

async function main() {
// Check the ticket API first, so a bad token can't leave a minted code with nowhere to go.
await j(`${API}/admin/stats`, { headers: { authorization: `Bearer ${kioskToken}` } });

const password = await askHidden(`Password for ${handle} on ${PDS}: `);
const { accessJwt } = await j(`${PDS}/xrpc/com.atproto.server.createSession`, {
	method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ identifier: handle, password })
});

let loaded = 0;
for (let i = 0; i < COUNT; i++) {
	const { code } = await j(`${PDS}/xrpc/com.atproto.server.createInviteCode`, {
		method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${accessJwt}` }, body: JSON.stringify({ useCount: USES })
	});
	const { added } = await j(`${API}/admin/codes`, {
		method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${kioskToken}` },
		body: JSON.stringify({ pds: 'memo', codes: [code], maxUses: USES })
	});
	loaded += added;
}
console.log(`minted and loaded ${loaded} memo.dog code(s), ${USES} uses each. Codes were not printed.`);
}
main().catch((e) => { console.error('failed:', e.message); process.exit(1); });
