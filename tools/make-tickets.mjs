// Print sheet of ticket QR codes for the registration desk.
//
//   ADMIN_TOKEN=... node make-tickets.mjs --mint 60             # mint 60 new tickets, then print them
//   ADMIN_TOKEN=... node make-tickets.mjs --unclaimed           # reprint every still-unclaimed ticket
//   ADMIN_TOKEN=... node make-tickets.mjs                       # reprint all tickets
//   node make-tickets.mjs --example                             # 6 fake "EX..." ids, no API/token/network at all
//   options: --api https://kiosk.tilde.style/api   --out qr-sheet.local.html
//
// Each QR encodes https://kiosk.tilde.style/t/<ID> — a ticket id, never an invite code, so the
// sheet is harmless if photographed. Output is *.local.html (gitignored). Print it, cut along the
// dashed lines. The id is also printed in large type as a manual fallback.

import QRCode from 'qrcode';
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (name, dflt) => { const i = args.indexOf(`--${name}`); return i < 0 ? dflt : args[i + 1]; };
const flag = (name) => args.includes(`--${name}`);

const API = opt('api', 'https://kiosk.tilde.style/api').replace(/\/$/, '');
const BASE = opt('base', 'https://kiosk.tilde.style/t/');
const OUT = opt('out', flag('example') ? 'example-qr-sheet.local.html' : 'qr-sheet.local.html');

let ids;
if (flag('example')) {
	// "EX" prefix so these can never be mistaken for real ids — none of these exist in any
	// database, nothing here touches the live API, ADMIN_TOKEN isn't even needed.
	ids = ['EX7Q', 'EXK2', 'EXR9', 'EXB4', 'EXM8', 'EXT3'];
} else {
	const token = process.env.ADMIN_TOKEN;
	if (!token) { console.error('set ADMIN_TOKEN in the environment'); process.exit(1); }
	const call = async (path, init = {}) => {
		const r = await fetch(API + path, { ...init, headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' } });
		const body = await r.json().catch(() => ({}));
		if (!r.ok) throw new Error(`${path}: ${r.status} ${JSON.stringify(body)}`);
		return body;
	};
	if (opt('mint')) {
		ids = (await call('/admin/tickets', { method: 'POST', body: JSON.stringify({ count: Number(opt('mint')) }) })).ids;
		console.log(`minted ${ids.length} tickets`);
	} else {
		ids = (await call('/admin/tickets' + (flag('unclaimed') ? '?unclaimed=1' : ''))).tickets.map((t) => t.id);
	}
}
if (!ids.length) { console.error('no tickets to print'); process.exit(1); }

const cells = [];
for (const id of ids) {
	const svg = await QRCode.toString(BASE + id, { type: 'svg', margin: 1, errorCorrectionLevel: 'M' });
	cells.push(`<div class="t"><div class="qr">${svg}</div><div class="id">${id}</div><div class="url">${BASE.replace('https://', '')}${id}</div></div>`);
}

writeFileSync(OUT, `<!doctype html><html><head><meta charset="utf-8"><title>IOSP tickets</title><style>
@page { size: A4; margin: 10mm; }
body { font-family: system-ui, sans-serif; margin: 0; }
.sheet { display: grid; grid-template-columns: repeat(3, 1fr); }
.t { border: 1px dashed #999; padding: 6mm 4mm; text-align: center; break-inside: avoid; height: 62mm; box-sizing: border-box; }
.qr svg { width: 38mm; height: 38mm; }
.id { font: 700 7mm/1.2 ui-monospace, monospace; letter-spacing: 0.15em; }
.url { font-size: 3mm; color: #555; }
</style></head><body><div class="sheet">${cells.join('\n')}</div></body></html>\n`);
console.log(`wrote ${OUT} (${ids.length} tickets) — open it and print, cut on the dashed lines`);
