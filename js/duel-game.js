// Where in Burlington's game-specific duel contract. The shared duel client
// treats payloads and results as opaque JSON; selection and winner rules live
// here so the browser UI and the two-phone test use the same definitions.

import { ROUNDS } from './game.js';

function mulberry32(seed) {
  let value = seed;
  return function () {
    value |= 0;
    value = (value + 0x6D2B79F5) | 0;
    let mixed = Math.imul(value ^ (value >>> 15), 1 | value);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function validateSeed(payload) {
  const seed = payload?.seed;
  if (!Number.isInteger(seed) || seed < 0 || seed > 0xffffffff) {
    throw new Error('bad_duel_payload');
  }
  return seed;
}

function indicesForSeed(length, seed) {
  const random = mulberry32(seed);
  const indices = Array.from({ length }, (_, index) => index);
  for (let i = indices.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [indices[i], indices[j]] = [indices[j], indices[i]];
  }
  return indices.slice(0, ROUNDS);
}

export function makeDuelPayload(spots, liveSpots, random = Math.random) {
  const liveFiles = new Set(liveSpots.map((spot) => spot.file));
  if (spots.length - liveFiles.size < ROUNDS) throw new Error('not_enough_duel_spots');
  const firstSeed = Math.floor(random() * 4294967296) >>> 0;
  for (let attempt = 0; attempt < 65536; attempt++) {
    const seed = (firstSeed + attempt) >>> 0;
    const selected = indicesForSeed(spots.length, seed).map((index) => spots[index]);
    if (selected.every((spot) => !liveFiles.has(spot.file))) return { seed };
  }
  throw new Error('could_not_seed_duel');
}

export function spotsForDuel(spots, payload, liveSpots = []) {
  const indices = indicesForSeed(spots.length, validateSeed(payload));
  const selected = indices.map((index) => spots[index]);
  const liveFiles = new Set(liveSpots.map((spot) => spot.file));
  if (selected.some((spot) => liveFiles.has(spot.file))) throw new Error('live_round_overlap');
  return selected;
}

export function duelPayloadToken(payload) {
  return validateSeed(payload).toString(36);
}

export function payloadFromDuelToken(token) {
  const value = String(token || '').toLowerCase();
  return { seed: /^[0-9a-z]+$/.test(value) ? Number.parseInt(value, 36) : NaN };
}

export function sameDuelPayload(a, b) {
  try {
    return duelPayloadToken(a) === duelPayloadToken(b);
  } catch {
    return false;
  }
}

// Returns 1 when mine wins, -1 when theirs wins, and 0 for a draw.
// Higher total points wins; equal totals go to the faster elapsed time.
export function compareDuelResults(mine, theirs) {
  if (mine.gaveUp || theirs.gaveUp) {
    if (mine.gaveUp && theirs.gaveUp) return 0;
    return mine.gaveUp ? -1 : 1;
  }
  if (mine.points !== theirs.points) return mine.points > theirs.points ? 1 : -1;
  if (mine.ms !== theirs.ms) return mine.ms < theirs.ms ? 1 : -1;
  return 0;
}
