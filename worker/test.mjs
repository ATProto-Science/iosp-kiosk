// Runs against `npm run dev` (http://127.0.0.1:8787). Fake codes only — never real ones.
const B = 'http://127.0.0.1:8787/api', A = { authorization: 'Bearer local-test-token', 'content-type': 'application/json' };
const post = (p, body, h = A) => fetch(B + p, { method: 'POST', headers: h, body: JSON.stringify(body) }).then(async (r) => [r.status, await r.json()]);
const get = (p, h) => fetch(B + p, { headers: h }).then(async (r) => [r.status, await r.json()]);
let fails = 0; const ok = (name, cond, info) => { console.log((cond ? 'ok   ' : 'FAIL ') + name, cond ? '' : JSON.stringify(info)); if (!cond) fails++; };

ok('admin needs token', (await post('/admin/tickets', { count: 1 }, {}))[0] === 401);
const [, { ids }] = await post('/admin/tickets', { count: 5 });
ok('mints 5 unique 4-char ids', new Set(ids).size === 5 && ids.every((i) => /^[2-9A-HJKMNP-Z]{4}$/.test(i)), ids);
await post('/admin/codes', { pds: 'aster', codes: ['test-aster-1', 'test-aster-2'], maxUses: 1 });
await post('/admin/codes', { pds: 'memo', codes: ['test-memo-1'], maxUses: 3 });

let [s, t] = await get('/ticket/' + ids[0].toLowerCase());
ok('lookup is case-insensitive, hides code', s === 200 && !t.claimed && !('code' in t) && t.available.aster === 2 && t.available.memo === 3, t);
ok('unknown ticket 404', (await get('/ticket/ZZZZ'))[0] === 404);

[s, t] = await post(`/ticket/${ids[0]}/claim`, { pds: 'aster' }, {});
ok('claim aster gives code', s === 200 && t.code === 'test-aster-1', t);
[s, t] = await post(`/ticket/${ids[0]}/claim`, { pds: 'memo' }, {});
ok('re-claim returns same code, ignores switch', t.code === 'test-aster-1' && t.pds === 'aster' && t.alreadyClaimed, t);

// Race: 4 tickets claim aster at once; only 1 code is left.
const race = await Promise.all(ids.slice(1).map((id) => post(`/ticket/${id}/claim`, { pds: 'aster' }, {})));
const got = race.filter(([s]) => s === 200).map(([, b]) => b.code), refused = race.filter(([s]) => s === 409);
ok('race: exactly one more aster code handed out, never duplicated', got.length === 1 && got[0] === 'test-aster-2' && refused.length === 3, race);

const loser = ids.slice(1).find((_, i) => race[i][0] === 409);
[s, t] = await post(`/ticket/${loser}/claim`, { pds: 'memo' }, {});
ok('ticket refused by aster can still claim memo', s === 200 && t.code === 'test-memo-1', [s, t]);
[s, t] = await get('/admin/stats', A);
ok('stats', s === 200 && t.codesLeft.aster === 0 && t.tickets.claimed === 3, t);
[s, t] = await get('/admin/tickets?unclaimed=1', A);
ok('admin ticket list (unclaimed only)', s === 200 && t.tickets.length === 2 && t.tickets.every((x) => !x.claimed), t);
ok('bad pds rejected', (await post(`/ticket/${ids[4]}/claim`, { pds: 'nope' }, {}))[0] === 400);
console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
