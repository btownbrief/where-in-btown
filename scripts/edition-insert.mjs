// Wednesday-edition insert: one puzzle → a Beehiiv-ready HTML block and a
// 600px PNG of the zoomed crop, rendered with the game's own crop logic
// (focalPoint + the same object-fit/transform CSS, at the middle stage).
//
//   node scripts/edition-insert.mjs <puzzle-id>            e.g. fletcher-free
//   node scripts/edition-insert.mjs --today                 today's first daily photo
//   node scripts/edition-insert.mjs <id> --date 2026-09-16  the Wednesday it runs (crop seed + filenames)
//   node scripts/edition-insert.mjs --list                  ids with their licence decision
//   ... --scale 2.4 --focal 55,40   tighten or move the crop when the default shows a legible sign
//
// Refuses any photo whose licence the insert cannot carry (CC BY-SA, unknown)
// and says why. Output: out/insert-<id>-<date>.png + .html (+ .json).
// Needs Playwright: NODE_PATH=<dir with playwright> (the same one the arcade's
// smoke suite uses). Nothing here uploads or posts anything.

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { createServer } from 'node:http';
import { extname, join } from 'node:path';
import { createRequire } from 'node:module';
import { dailySpots, focalPoint, liveTodayKey } from '../js/game.js';
import { licenceDecision, puzzleId, findSpot, insertHtml } from './insert-lib.mjs';

const ROOT = new URL('..', import.meta.url).pathname;
const OUT = join(ROOT, 'out');
const SIZE = 600;          // px, square (INSERT-SPEC §3: square survives every inbox)
const args = process.argv.slice(2);
const flag = (n) => { const i = args.indexOf(n); return i >= 0 ? (args[i + 1] || true) : null; };
const SCALE = typeof flag('--scale') === 'string' ? Number(flag('--scale')) : 1.9;   // the game's MIDDLE stage by default
if (!(SCALE >= 1 && SCALE <= 6)) { console.error('--scale must be between 1 and 6'); process.exit(2); }
const FLAG_VALUES = new Set(['--date', '--scale', '--focal'].map((n) => flag(n)).filter((v) => typeof v === 'string'));

const spots = JSON.parse(await readFile(join(ROOT, 'data/spots.json'), 'utf8'));
const date = typeof flag('--date') === 'string' ? flag('--date') : liveTodayKey();

if (args.includes('--list')) {
  for (const s of spots) { const d = licenceDecision(s); console.log(`${d.ok ? 'OK ' : 'NO '} ${puzzleId(s).padEnd(28)} ${s.license.padEnd(14)} ${s.name}`); }
  process.exit(0);
}

let spot;
if (args.includes('--today')) {
  spot = dailySpots(spots, date)[0];
} else {
  const id = args.find((a) => !a.startsWith('--') && !FLAG_VALUES.has(a));
  if (!id) { console.error('usage: node scripts/edition-insert.mjs <puzzle-id> | --today [--date YYYY-MM-DD] | --list'); process.exit(2); }
  spot = findSpot(spots, id);
  if (!spot) { console.error(`no puzzle with id "${id}" (ids are photo file basenames; try --list)`); process.exit(2); }
}
const id = puzzleId(spot);
const decision = licenceDecision(spot);
if (!decision.ok) {
  console.error(`REFUSED: ${id} (${spot.name}) — ${decision.reason}`);
  process.exit(3);
}

// same-week separation (INSERT-SPEC §2): warn if the daily game runs this photo on the insert date
const daily = dailySpots(spots, date).map(puzzleId);
if (daily.includes(id)) console.error(`WARNING: ${id} is in the daily game's set for ${date}; the spec says never the same week.`);

// ---- render the crop with the game's own logic
const require = createRequire(import.meta.url);
let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.error('Playwright not found. Run with NODE_PATH=<dir containing node_modules/playwright>.'); process.exit(4); }

let f = focalPoint(spot, `insert:${date}`);
if (typeof flag('--focal') === 'string') {
  const [x, y] = flag('--focal').split(',').map(Number);
  if (!(x >= 0 && x <= 100 && y >= 0 && y <= 100)) { console.error('--focal is "x,y" in percent of the image'); process.exit(2); }
  f = { x, y };
}
const MIME = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.html': 'text/html' };
const server = createServer(async (req, res) => {
  const path = decodeURIComponent(new URL(req.url, 'http://x').pathname);
  if (path === '/crop.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    // the same rules as index.html: #photoFrame overflow hidden, #photo object-fit cover,
    // transform-origin at the focal point, scale = the stage. Square frame.
    res.end(`<!doctype html><html><body style="margin:0;background:#000">
<div id="photoFrame" style="position:relative;width:${SIZE}px;height:${SIZE}px;overflow:hidden">
<img id="photo" src="/${spot.file}" style="position:absolute;top:0;left:0;width:100%;height:100%;object-fit:cover;transform-origin:${f.x}% ${f.y}%;transform:scale(${SCALE})">
</div></body></html>`);
    return;
  }
  try { const body = await readFile(join(ROOT, path)); res.writeHead(200, { 'Content-Type': MIME[extname(path)] || 'application/octet-stream' }); res.end(body); }
  catch { res.writeHead(404); res.end(); }
});
await new Promise((r) => server.listen(0, r));
const base = `http://127.0.0.1:${server.address().port}`;
await mkdir(OUT, { recursive: true });
const png = join(OUT, `insert-${id}-${date}.png`);
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: SIZE, height: SIZE }, deviceScaleFactor: 1 });
await page.goto(`${base}/crop.html`);
await page.waitForFunction(() => document.getElementById('photo').complete && document.getElementById('photo').naturalWidth > 0);
await page.locator('#photoFrame').screenshot({ path: png });
await browser.close();
server.close();

const html = insertHtml({ spot, id, src: `insert-${id}-${date}.png`, date, attribution: decision.attribution });
const htmlPath = join(OUT, `insert-${id}-${date}.html`);
await writeFile(htmlPath, html);
await writeFile(join(OUT, `insert-${id}-${date}.json`), JSON.stringify({ id, date, name: spot.name, hint: spot.hint, license: spot.license, author: spot.author, sourceUrl: spot.sourceUrl, focal: f, scale: SCALE, size: SIZE, attribution: decision.attribution, deep_link: `https://btownbrief.github.io/where-in-btown/?p=${id}&d=${date}` }, null, 2));
console.log(`OK ${id} (${spot.name}) · ${spot.license}${decision.kind === 'by' ? ' · attribution required' : decision.kind === 'cc0' ? ' · courtesy credit' : ''}`);
console.log(`  crop: ${png}`);
console.log(`  block: ${htmlPath}  (upload the PNG to Beehiiv, then replace data-src with the asset URL)`);
console.log('  CHECK THE CROP by eye: nothing legible (a sign, a house number, a logo) may give it away.');
console.log('  If it does, re-run with --scale 2.4 or --focal x,y (percent). The peek link matches only the default crop.');
console.log(`  reveal link: https://btownbrief.github.io/where-in-btown/?p=${id}&d=${date}`);
