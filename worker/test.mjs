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

// --- revoke: tickets ---
const stillOpen = ids.slice(1).filter((id, i) => race[i][0] === 409 && id !== loser);
ok('exactly 2 tickets still open going into revoke tests', stillOpen.length === 2, stillOpen);
const [victim, spare] = stillOpen;

[s, t] = await post(`/admin/tickets/${victim}/revoke`, {});
ok('revoke ticket toggles disabled=true', s === 200 && t.disabled === true, t);
[s, t] = await get('/ticket/' + victim);
ok('revoked ticket looks exactly like unknown to the public route', s === 404 && t.error === 'unknown ticket', t);
[s, t] = await post(`/ticket/${victim}/claim`, { pds: 'memo' }, {});
ok('revoked ticket cannot be claimed', s === 404, t);
[s, t] = await get('/admin/tickets?unclaimed=1', A);
ok('revoked-but-unclaimed ticket excluded from the reprint list', s === 200 && !t.tickets.some((x) => x.id === victim), t);

[s, t] = await post(`/admin/tickets/${victim}/revoke`, {});
ok('revoking again un-revokes (toggle)', s === 200 && t.disabled === false, t);
[s, t] = await get('/ticket/' + victim);
ok('un-revoked ticket is visible again', s === 200, t);

ok('revoke on unknown ticket 404s', (await post('/admin/tickets/ZZZZ/revoke', {}))[0] === 404);

[s, t] = await get('/admin/tickets', A);
const spareRow = t.tickets.find((x) => x.id === spare);
ok('full admin ticket list includes pds/disabled/timestamps', s === 200 && spareRow && spareRow.disabled === false && 'createdAt' in spareRow, spareRow);

// --- revoke: codes ---
[s, t] = await get('/admin/codes', A);
const memoCode = t.codes.find((c) => c.pds === 'memo');
ok('admin code list masks the value, exposes uses/maxUses', s === 200 && memoCode && memoCode.code !== 'test-memo-1' && memoCode.code.includes('…') && memoCode.uses === 1 && memoCode.maxUses === 3, memoCode);

[s, t] = await post(`/admin/codes/${memoCode.id}/revoke`, {});
ok('revoke code toggles disabled=true', s === 200 && t.disabled === true, t);
[s, t] = await get('/ticket/' + spare);
ok('availability drops to 0 once the only memo code is revoked', s === 200 && t.available.memo === 0, t);
[s, t] = await post(`/ticket/${spare}/claim`, { pds: 'memo' }, {});
ok('claiming against a fully-revoked pds pool is refused, ticket released', s === 409, t);
[s, t] = await get('/ticket/' + spare);
ok('released ticket is unclaimed again after the refused claim', s === 200 && !t.claimed, t);

[s, t] = await post(`/admin/codes/${memoCode.id}/revoke`, {});
ok('un-revoking the code restores it', s === 200 && t.disabled === false, t);
[s, t] = await get('/ticket/' + spare);
ok('availability comes back', s === 200 && t.available.memo === 2, t); // test-memo-1: maxUses 3, 1 real use so far

ok('revoke on unknown code id 404s', (await post('/admin/codes/999999/revoke', {}))[0] === 404);
ok('revoke on non-numeric code id 400s', (await post('/admin/codes/nope/revoke', {}))[0] === 400);
ok('code revoke needs admin token', (await post(`/admin/codes/${memoCode.id}/revoke`, {}, {}))[0] === 401);

console.log(fails ? `\n${fails} FAILED` : '\nall passed'); process.exit(fails ? 1 : 0);
