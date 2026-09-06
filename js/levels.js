// Levels mode: a fixed ladder of five-photo puzzles that unlock in order.
// Pure module (no DOM); progress lives in localStorage under 'wib-levels'.
//
// Difficulty is the ZOOM START. Level 1 opens at a gentle 1.9× crop; the
// last levels open at 4.2×, tighter than the daily game's 3.4×. The middle
// and final stages always land on 1.0× (full frame), so a level can always
// be finished, it just costs points to get there.
//
// The ladder is deterministic from one seed, so everyone's Level 7 is the
// same five photos forever — that is what makes "I cleared level 7" mean
// something in a share. Adding photos to spots.json appends new levels at
// the END without reshuffling the old ones (see levelSpots).

import { ROUNDS } from './game.js';

export const LEVEL_SIZE = ROUNDS;             // five photos per level
export const LEVELS_KEY = 'wib-levels';
const SEED = 'where-in-btown:levels:v1';

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function mulberry32(a) {
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Stable order: sort by file (so the ladder doesn't depend on spots.json
// order), then shuffle with the fixed seed. Photos added later land in a
// second pass appended after the first 70, so existing levels never move.
export function ladder(spots) {
  const base = [...spots].sort((a, b) => a.file.localeCompare(b.file));
  const first = base.slice(0, 74);      // the original database (frozen size)
  const later = base.slice(74);
  const shuffle = (arr, salt) => {
    const rng = mulberry32(hashString(`${SEED}:${salt}`));
    const idx = arr.map((_, i) => i);
    for (let i = idx.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [idx[i], idx[j]] = [idx[j], idx[i]]; }
    return idx.map((i) => arr[i]);
  };
  return [...shuffle(first, 'a'), ...shuffle(later, 'b')];
}

export function levelCount(spots) { return Math.floor(spots.length / LEVEL_SIZE); }

export function levelSpots(spots, level) {
  const n = levelCount(spots);
  if (!Number.isInteger(level) || level < 1 || level > n) throw new Error('bad_level');
  const l = ladder(spots);
  return l.slice((level - 1) * LEVEL_SIZE, level * LEVEL_SIZE);
}

// Zoom start per level: [tight, mid, wide]. Wide is always the full frame.
export function levelScales(level) {
  if (level <= 1) return [1.9, 1.4, 1.0];
  if (level <= 3) return [2.4, 1.6, 1.0];
  if (level <= 6) return [3.0, 1.9, 1.0];
  if (level <= 9) return [3.4, 1.9, 1.0];
  if (level <= 12) return [3.8, 2.2, 1.0];
  return [4.2, 2.4, 1.0];
}
export function difficultyLabel(level) {
  const s = levelScales(level)[0];
  return s < 2.5 ? 'easy' : s < 3.4 ? 'medium' : s < 4 ? 'hard' : 'expert';
}

// Stars from a five-round total (max 7,500 = five 1,500-point hard solves).
export function levelStars(total) {
  if (total >= 6000) return 3;
  if (total >= 4500) return 2;
  if (total >= 3000) return 1;
  return 0;
}
export const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

// ------------------------------------------------------------ progress
// { unlocked: highest playable level, best: { "3": 5120 }, cleared: ["1","2"] }
export function loadLevels(storage = globalThis.localStorage) {
  try {
    const p = JSON.parse(storage.getItem(LEVELS_KEY)) || {};
    return { unlocked: Math.max(1, p.unlocked | 0), best: p.best || {}, cleared: Array.isArray(p.cleared) ? p.cleared : [] };
  } catch { return { unlocked: 1, best: {}, cleared: [] }; }
}
// Finishing a level (any score) clears it and unlocks the next; best score is kept.
export function recordLevel(level, total, spots, storage = globalThis.localStorage) {
  const p = loadLevels(storage);
  const key = String(level);
  p.best[key] = Math.max(p.best[key] || 0, total | 0);
  if (!p.cleared.includes(key)) p.cleared.push(key);
  p.unlocked = Math.min(levelCount(spots), Math.max(p.unlocked, level + 1));
  storage.setItem(LEVELS_KEY, JSON.stringify(p));
  return p;
}
export function isUnlocked(level, progress) { return level <= progress.unlocked; }

// The badge that goes on the share text: "Level 7 · ★★☆ · hard".
export function levelBadge(level, total) {
  return `Level ${level} · ${starText(levelStars(total))} · ${difficultyLabel(level)}`;
}
