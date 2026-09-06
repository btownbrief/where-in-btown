// Levels + insert rules, offline. node scripts/test-levels.mjs
import { readFile } from 'node:fs/promises';
import assert from 'node:assert/strict';
import { ladder, levelCount, levelSpots, levelScales, levelStars, loadLevels, recordLevel, isUnlocked, levelBadge, LEVEL_SIZE } from '../js/levels.js';
import { dailySpots } from '../js/game.js';
import { licenceDecision, puzzleId, findSpot, insertHtml } from './insert-lib.mjs';

const spots = JSON.parse(await readFile(new URL('../data/spots.json', import.meta.url), 'utf8'));
const store = new Map();
const storage = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)), removeItem: (k) => store.delete(k) };

// ladder: deterministic, every photo at most once, no level shares a photo
const l1 = ladder(spots), l2 = ladder([...spots].reverse());
assert.deepEqual(l1.map((s) => s.file), l2.map((s) => s.file), 'ladder does not depend on spots.json order');
assert.equal(new Set(l1.map((s) => s.file)).size, spots.length, 'every photo appears once');
const n = levelCount(spots);
assert.equal(n, Math.floor(spots.length / LEVEL_SIZE));
assert.ok(n >= 14, `at least 14 levels from 74 photos (${n})`);
const seen = new Set();
for (let lv = 1; lv <= n; lv++) {
  const set = levelSpots(spots, lv);
  assert.equal(set.length, LEVEL_SIZE);
  for (const s of set) { assert.ok(!seen.has(s.file), `photo ${s.file} in two levels`); seen.add(s.file); }
}
assert.throws(() => levelSpots(spots, 0), /bad_level/);
assert.throws(() => levelSpots(spots, n + 1), /bad_level/);
// adding photos appends, never moves existing levels
const more = [...spots, { file: 'photos/zz-new-1.jpg', name: 'New 1' }, { file: 'photos/zz-new-2.jpg', name: 'New 2' }];
for (let lv = 1; lv <= n; lv++) assert.deepEqual(levelSpots(more, lv).map((s) => s.file), levelSpots(spots, lv).map((s) => s.file), `level ${lv} moved after adding photos`);

// difficulty: zoom start never loosens as levels climb; wide is always full frame
let prev = 0;
for (let lv = 1; lv <= 20; lv++) { const [t, m, w] = levelScales(lv); assert.ok(t >= prev, 'tight zoom is monotonic'); assert.ok(t > m && m > w, 'stages tighten'); assert.equal(w, 1.0); prev = t; }
assert.ok(levelScales(1)[0] < 3.4 && levelScales(20)[0] > 3.4, 'ladder spans easier-than-daily to harder-than-daily');

// stars and progress
assert.equal(levelStars(7500), 3); assert.equal(levelStars(6000), 3); assert.equal(levelStars(4500), 2); assert.equal(levelStars(3000), 1); assert.equal(levelStars(2999), 0);
let p = loadLevels(storage);
assert.equal(p.unlocked, 1); assert.ok(isUnlocked(1, p) && !isUnlocked(2, p));
p = recordLevel(1, 3200, spots, storage);
assert.equal(p.unlocked, 2); assert.deepEqual(p.cleared, ['1']); assert.equal(p.best['1'], 3200);
p = recordLevel(1, 2000, spots, storage);
assert.equal(p.best['1'], 3200, 'best is kept'); assert.equal(p.unlocked, 2, 'replaying does not skip');
for (let lv = 2; lv <= n; lv++) p = recordLevel(lv, 5000, spots, storage);
assert.equal(p.unlocked, n, 'unlocked never exceeds the level count');
assert.match(levelBadge(7, 4600), /^Level 7 · ★★☆ · hard$/);

// insert: licence gate
const counts = { ok: 0, no: 0 };
for (const s of spots) { const d = licenceDecision(s); counts[d.ok ? 'ok' : 'no']++; if (/BY-SA/.test(s.license)) assert.ok(!d.ok && /share-alike/.test(d.reason), 'BY-SA refused with the reason'); if (/^CC BY \d/.test(s.license)) assert.ok(d.ok && d.attribution.includes(s.author) && d.attribution.includes(s.license), 'BY passes with author + licence'); if (s.license === 'CC0') assert.ok(d.ok); }
assert.equal(counts.no, 51, `51 share-alike photos refused (${counts.no})`);
assert.equal(counts.ok, 23, `23 usable Wikimedia photos (${counts.ok})`);
assert.ok(licenceDecision({ license: 'own', file: 'photos/own/x.jpg' }).ok && licenceDecision({ license: 'own' }).attribution === '', "Stephen's own photos need no credit");
assert.ok(!licenceDecision({ license: '' }).ok, 'missing licence refused');
// ids + block
const flynn = findSpot(spots, 'flynn'); assert.ok(flynn && puzzleId(flynn) === 'flynn');
const by = spots.find((s) => /^CC BY \d/.test(s.license));
const html = insertHtml({ spot: by, id: puzzleId(by), src: 'x.png', date: '2026-09-16', attribution: licenceDecision(by).attribution });
assert.ok(html.includes(`?p=${puzzleId(by)}`) && html.includes('Where in Btown?') && html.includes(by.author) && html.includes('creativecommons.org'), 'block carries deep link + attribution + licence link');
assert.ok(!insertHtml({ spot: { file: 'photos/own/a.jpg', license: 'own' }, id: 'a', src: 'x.png', date: '2026-09-16', attribution: '' }).includes('Photo:'), 'own photo: no credit line');
// same-week check helper exists in game.js
assert.equal(dailySpots(spots, '2026-09-16').length, 5);
console.log(`test-levels: ok (${n} levels, ${counts.ok} insert-able photos, ${counts.no} refused)`);
