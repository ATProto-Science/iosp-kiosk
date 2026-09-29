// Ticket -> invite-code API for the IOSP registration desk.
//
//   GET  /api/ticket/:id            ticket state + which PDSes still have codes
//   POST /api/ticket/:id/claim      {pds}  -> {pds, code}   (idempotent per ticket)
//   POST /api/admin/tickets         {count}               -> {ids}
//   GET  /api/admin/tickets[?unclaimed=1]                 -> {tickets:[{id,claimed}]}
//   POST /api/admin/codes           {pds, codes[], maxUses} -> {added}
//   GET  /api/admin/stats
// Admin routes need `Authorization: Bearer <ADMIN_TOKEN>`.

const PDSES = new Set(['aster', 'memo']);
const ALPHABET = '23456789ABCDEFGHJKMNPQRSTUVWXYZ'; // no 0/O, 1/I/L

const json = (body, status = 200) =>
	new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function newTicketId() {
	const bytes = crypto.getRandomValues(new Uint8Array(4));
	return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join('');
}

const normId = (s) => String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, '');

async function availability(db) {
	const { results } = await db
		.prepare('SELECT pds, SUM(max_uses - uses) AS left FROM codes GROUP BY pds')
		.all();
	const out = { aster: 0, memo: 0 };
	for (const r of results) out[r.pds] = Math.max(0, r.left);
	return out;
}

async function getTicket(db, id) {
	return db
		.prepare('SELECT t.id, t.pds, t.claimed_at, c.code FROM tickets t LEFT JOIN codes c ON c.id = t.code_id WHERE t.id = ?')
		.bind(id)
		.first();
}

async function claim(db, id, pds) {
	const t = await getTicket(db, id);
	if (!t) return json({ error: 'unknown ticket' }, 404);
	if (t.pds) {
		// Already claimed: same answer every time, whatever PDS is asked for now.
		return json({ pds: t.pds, code: t.code, alreadyClaimed: true });
	}
	if (!PDSES.has(pds)) return json({ error: 'unknown pds' }, 400);

	// Step 1: win the ticket. Only the request whose UPDATE changes a row may continue,
	// so two simultaneous claims of one ticket can't both take a code.
	const won = await db
		.prepare("UPDATE tickets SET pds = ?, claimed_at = datetime('now') WHERE id = ? AND pds IS NULL")
		.bind(pds, id)
		.run();
	if (won.meta.changes !== 1) return json(await getTicket(db, id).then((x) => ({ pds: x.pds, code: x.code, alreadyClaimed: true })));

	// Step 2: take one use of one code. A single statement, so it is atomic in D1.
	const taken = await db
		.prepare(
			`UPDATE codes SET uses = uses + 1
			 WHERE id = (SELECT id FROM codes WHERE pds = ? AND uses < max_uses ORDER BY id LIMIT 1)
			 RETURNING id, code`
		)
		.bind(pds)
		.first();
	if (!taken) {
		// Out of codes for this PDS: give the ticket back so the person can pick the other one.
		await db.prepare('UPDATE tickets SET pds = NULL, claimed_at = NULL WHERE id = ?').bind(id).run();
		return json({ error: 'no codes left for this PDS', pds }, 409);
	}
	await db.prepare('UPDATE tickets SET code_id = ? WHERE id = ?').bind(taken.id, id).run();
	return json({ pds, code: taken.code });
}

const handler = {
	async fetch(req, env) {
		const url = new URL(req.url);
		const parts = url.pathname.split('/').filter(Boolean); // ['api', ...]
		if (parts[0] !== 'api') return json({ error: 'not found' }, 404);
		const db = env.DB;

		if (parts[1] === 'ticket' && parts[2]) {
			const id = normId(parts[2]);
			if (parts[3] === 'claim' && req.method === 'POST') {
				const body = await req.json().catch(() => ({}));
				return claim(db, id, body.pds);
			}
			if (!parts[3] && req.method === 'GET') {
				const t = await getTicket(db, id);
				if (!t) return json({ error: 'unknown ticket' }, 404);
				// The code is only revealed via claim, never on a plain GET.
				return json({ id: t.id, claimed: !!t.pds, pds: t.pds, available: await availability(db) });
			}
		}

		if (parts[1] === 'admin') {
			const ok = env.ADMIN_TOKEN && req.headers.get('authorization') === `Bearer ${env.ADMIN_TOKEN}`;
			if (!ok) return json({ error: 'unauthorized' }, 401);

			if (parts[2] === 'tickets' && req.method === 'POST') {
				const { count = 1 } = await req.json().catch(() => ({}));
				const n = Math.min(Math.max(parseInt(count, 10) || 1, 1), 500);
				const ids = [];
				while (ids.length < n) {
					const id = newTicketId();
					const r = await db.prepare('INSERT OR IGNORE INTO tickets (id) VALUES (?)').bind(id).run();
					if (r.meta.changes === 1) ids.push(id);
				}
				return json({ ids });
			}
			if (parts[2] === 'tickets' && req.method === 'GET') {
				const q = url.searchParams.get('unclaimed') ? 'WHERE pds IS NULL' : '';
				const { results } = await db.prepare(`SELECT id, pds IS NOT NULL AS claimed FROM tickets ${q} ORDER BY created_at, id`).all();
				return json({ tickets: results.map((r) => ({ id: r.id, claimed: !!r.claimed })) });
			}
			if (parts[2] === 'codes' && req.method === 'POST') {
				const { pds, codes, maxUses = 1 } = await req.json().catch(() => ({}));
				if (!PDSES.has(pds) || !Array.isArray(codes)) return json({ error: 'need pds and codes[]' }, 400);
				const stmts = codes.map((c) =>
					db.prepare('INSERT OR IGNORE INTO codes (pds, code, max_uses) VALUES (?, ?, ?)').bind(pds, String(c).trim(), maxUses)
				);
				const res = await db.batch(stmts);
				return json({ added: res.reduce((n, r) => n + r.meta.changes, 0) });
			}
			if (parts[2] === 'stats' && req.method === 'GET') {
				const tix = await db
					.prepare("SELECT COUNT(*) AS total, SUM(pds IS NOT NULL) AS claimed FROM tickets")
					.first();
				return json({ tickets: tix, codesLeft: await availability(db) });
			}
		}
		return json({ error: 'not found' }, 404);
	}
};

// DEV_CORS is only ever set in worker/.dev.vars, so local page tests can call this API cross-origin.
export default {
	async fetch(req, env) {
		if (env.DEV_CORS && req.method === 'OPTIONS')
			return new Response(null, { headers: { 'access-control-allow-origin': '*', 'access-control-allow-headers': '*' } });
		const res = await handler.fetch(req, env);
		if (env.DEV_CORS) res.headers.set('access-control-allow-origin', '*');
		return res;
	}
};
