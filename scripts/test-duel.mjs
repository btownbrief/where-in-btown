// Duel wiring test: drives the real vendored duel client (js/duel.js →
// js/rooms.js) against the local shim as two simulated phones playing the
// same five seed-selected Burlington photos. No network, no Supabase.
//
//   node scripts/test-duel.mjs

import { readFile } from 'node:fs/promises';
import { createRooms } from './rooms-shim.mjs';
import { dailySpots } from '../js/game.js';
import {
  makeDuelPayload, spotsForDuel, compareDuelResults,
} from '../js/duel-game.js';

const GAME = 'where-in-btown';

/* ------------------------------------------------- two-phone environment */

const stores = new Map();
let current = 'A';
globalThis.localStorage = {
  getItem: (key) => (stores.get(current).has(key) ? stores.get(current).get(key) : null),
  setItem: (key, value) => stores.get(current).set(key, String(value)),
  removeItem: (key) => stores.get(current).delete(key),
};
function device(id) {
  if (!stores.has(id)) stores.set(id, new Map());
  current = id;
}
device('A');
device('B');

let passed = 0;
function t(condition, label) {
  if (!condition) {
    console.error(`FAIL: ${label}`);
    process.exit(1);
  }
  passed++;
  console.log(`  ok — ${label}`);
}
async function expectCode(promise, code, label) {
  try {
    await promise;
    t(false, `${label} (no error thrown)`);
  } catch (error) {
    t(error && error.code === code, `${label} (got ${error && error.code})`);
  }
}

const shim = createRooms();
globalThis.BTOWN_ROOMS_URL = 'http://rooms.test';
globalThis.fetch = async (url, options = {}) => {
  const match = String(url).match(/\/rest\/v1\/rpc\/(\w+)$/);
  const fn = match && shim.rpcs[match[1]];
  if (!fn || options.method !== 'POST') {
    return new Response(JSON.stringify({ message: 'not a room rpc' }), { status: 404 });
  }
  try {
    const body = fn(JSON.parse(options.body || '{}')) ?? {};
    return new Response(JSON.stringify(body), {
      status: 200, headers: { 'Content-Type': 'application/json' },
    });
  } catch (error) {
    return new Response(JSON.stringify({ message: error.message }), {
      status: error.rpc ? 400 : 500, headers: { 'Content-Type': 'application/json' },
    });
  }
};
const { Duel, savedSession } = await import('../js/duel.js');

/* ------------------------------------------------------------ the tests */

const spots = JSON.parse(await readFile(new URL('../data/spots.json', import.meta.url), 'utf8'));
const live = dailySpots(spots, '2026-07-30');
const payload = makeDuelPayload(spots, live, () => 0.417);
const phoneAFiles = spotsForDuel(spots, payload, live).map((spot) => spot.file);
const phoneBFiles = spotsForDuel(spots, JSON.parse(JSON.stringify(payload)), live)
  .map((spot) => spot.file);
const liveFiles = new Set(live.map((spot) => spot.file));

t(Number.isInteger(payload.seed), 'payload is one compact deterministic seed');
t(JSON.stringify(phoneAFiles) === JSON.stringify(phoneBFiles),
  'same payload resolves to identical challenge content on both phones');
t(phoneAFiles.every((file) => !liveFiles.has(file)),
  'duel challenge excludes every photo in the live daily round');
let rejectedLivePayload = false;
try {
  let overlappingSeed = 0;
  while (spotsForDuel(spots, { seed: overlappingSeed })
    .every((spot) => !liveFiles.has(spot.file))) {
    overlappingSeed++;
  }
  spotsForDuel(spots, { seed: overlappingSeed }, live);
} catch {
  rejectedLivePayload = true;
}
t(rejectedLivePayload, 'payload validation rejects a set containing the live round');

device('A');
const host = await Duel.create({ game: GAME, name: 'Ada', payload });
t(/^[A-Z2-9]{4}$/.test(host.code) && host.status === 'waiting', 'host opens a duel');
t(savedSession(GAME)?.roomId === host.match.roomId, 'host session saved');

device('B');
const guest = await Duel.join({ game: GAME, code: host.code.toLowerCase(), name: 'Bea' });
t(guest.status === 'playing' &&
  guest.payload.seed === payload.seed,
'guest joins with the same photo seed');

device('A');
await host.match._fetch();
t(host.status === 'playing' && host.others()[0].name === 'Bea', 'host sees the duel start');

// Both submit concurrently — the version lock forces one to retry-merge.
device('A');
const pushA = host.submitResult({ points: 4200, ms: 61234 });
device('B');
const pushB = guest.submitResult({ points: 4100, ms: 50560 });
await Promise.all([pushA, pushB]);
device('A');
await host.match._fetch();
device('B');
await guest.match._fetch();
t(host.isComplete() && guest.isComplete(), 'both results merged despite the race');
t(host.status === 'over' && guest.status === 'over', 'duel marked over');
t(host.others()[0].result.points === 4100 && guest.others()[0].result.points === 4200,
  'each phone sees the rival score');
t(compareDuelResults(host.myResult(), host.others()[0].result) === 1,
  'higher total wins even when it took longer');
t(compareDuelResults({ points: 4200, ms: 60000 }, { points: 4200, ms: 61000 }) === 1,
  'equal totals break toward the faster time');
t(compareDuelResults({ points: 4200, ms: 60000 }, { points: 4200, ms: 60000 }) === 0,
  'equal totals and times draw');
t(compareDuelResults({ points: 0, ms: 1, gaveUp: true }, { points: 0, ms: 99999 }) === -1,
  'a concession loses even against a zero-point finish');

// Resubmitting is a write-once no-op.
await host.submitResult({ points: 9999, ms: 1 });
device('B');
await guest.match._fetch();
t(guest.others()[0].result.points === 4200, 'results are write-once');

// Rematch deals a fresh explicit photo set to both.
const rematchPayload = makeDuelPayload(spots, live, () => 0.731);
device('B');
await guest.rematch(rematchPayload);
device('A');
await host.match._fetch();
t(host.payload.seed === rematchPayload.seed &&
  Object.keys(host.results).length === 0 && host.status === 'playing',
'rematch: fresh seeded photos, empty results');

// Racing rematches converge on exactly one payload.
const dealOne = makeDuelPayload(spots, live, () => 0.193);
const dealTwo = makeDuelPayload(spots, live, () => 0.887);
device('A');
const dealA = host.rematch(dealOne);
device('B');
const dealB = guest.rematch(dealTwo);
await Promise.all([dealA, dealB]);
device('A'); await host.match._fetch();
device('B'); await guest.match._fetch();
t(host.payload.seed === guest.payload.seed,
  'racing rematches converge on one photo set');

// Resume after a refresh.
device('A');
const resumed = await Duel.resume({ game: GAME });
t(resumed.match.roomId === host.match.roomId &&
  resumed.payload.seed === host.payload.seed,
'resume reattaches to the duel');

// Leaving bars the stranded rival's submit and tells them why.
await resumed.leave();
t(savedSession(GAME) === null, 'leave clears the session');
device('B');
await guest.match._fetch();
t(guest.others()[0].left === true, 'guest sees the host left');
await expectCode(guest.submitResult({ points: 3000, ms: 70000 }), 'opponent_left',
  'submit into an abandoned duel says why');

console.log(`\nALL DUEL TESTS PASSED (${passed} checks)`);
process.exit(0);
