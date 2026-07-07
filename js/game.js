// Daily round selection, scoring, and persistent state.

const TZ = 'America/New_York';
export const GUESSES_PER_ROUND = 3;
export const ROUNDS = 5;
export const SOLVE_RADIUS_M = 150;
const STAGE_BONUS = [1.5, 1.2, 1.0];

// today's key, e.g. "2026-07-07" (NY time); ?testdate=YYYY-MM-DD overrides
export function todayKey() {
  const t = new URLSearchParams(location.search).get('testdate');
  if (t && /^\d{4}-\d{2}-\d{2}$/.test(t)) return t;
  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(new Date());
}

// ms until the next NY midnight
export function msToTomorrow() {
  const now = new Date();
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone: TZ, hour12: false,
      hour: 'numeric', minute: 'numeric', second: 'numeric',
    }).formatToParts(now).map((p) => [p.type, p.value]),
  );
  const secsToday = (Number(parts.hour) % 24) * 3600 + Number(parts.minute) * 60 + Number(parts.second);
  return (86400 - secsToday) * 1000;
}

function hashString(s) {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
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

// deterministic 5 spots for the date, same for everyone
export function dailySpots(spots, dateKey) {
  const rng = mulberry32(hashString(`where-in-btown:${dateKey}`));
  const idx = spots.map((_, i) => i);
  for (let i = idx.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [idx[i], idx[j]] = [idx[j], idx[i]];
  }
  return idx.slice(0, ROUNDS).map((i) => spots[i]);
}

// deterministic crop focal point for a photo (percent of image)
export function focalPoint(spot, dateKey) {
  const rng = mulberry32(hashString(`${spot.file}:${dateKey}`));
  return { x: 30 + rng() * 40, y: 25 + rng() * 40 }; // central-ish detail
}

export function haversineM(a, b) {
  const R = 6371000, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const s = Math.sin(dLat / 2) ** 2
    + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// GeoGuessr-style decay: 1000 pts at <=25 m, smoothly to 0 at 2 km
export function distancePoints(m) {
  if (m <= 25) return 1000;
  if (m >= 2000) return 0;
  return Math.round(1000 * Math.pow((2000 - m) / 1975, 1.5));
}

// stageIdx = zoom stage (0 tight, 1 mid, 2 wide) the round ended on
export function roundScore(distanceM, stageIdx, solved) {
  const bonus = solved ? STAGE_BONUS[Math.min(stageIdx, 2)] : 1.0;
  return Math.round(distancePoints(distanceM) * bonus);
}

export function fmtDist(m) {
  return m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(2)} km`;
}

export function emojiFor(distanceM, solvedStage) {
  if (solvedStage === 0 && distanceM <= SOLVE_RADIUS_M) return '🎯';
  if (distanceM <= SOLVE_RADIUS_M) return '🟢';
  if (distanceM <= 500) return '🟡';
  if (distanceM <= 1000) return '🟠';
  return '🔴';
}

// ------------------------------------------------------------ persistence

const STATE_KEY = 'wib-state';
const STREAK_KEY = 'wib-streak';

export function loadState(dateKey) {
  try {
    const s = JSON.parse(localStorage.getItem(STATE_KEY));
    if (s && s.date === dateKey) return s;
  } catch { /* fresh */ }
  return { date: dateKey, round: 0, stage: 0, rounds: [], done: false, submitted: false };
}
export function saveState(s) {
  localStorage.setItem(STATE_KEY, JSON.stringify(s));
}

// call once when today's game completes; returns current streak
export function bumpStreak(dateKey) {
  let st = { last: '', streak: 0, best: 0 };
  try { st = { ...st, ...JSON.parse(localStorage.getItem(STREAK_KEY)) }; } catch { /* fresh */ }
  if (st.last === dateKey) return st;
  const prev = new Date(`${dateKey}T12:00:00Z`);
  prev.setUTCDate(prev.getUTCDate() - 1);
  const prevKey = prev.toISOString().slice(0, 10);
  st.streak = st.last === prevKey ? st.streak + 1 : 1;
  st.best = Math.max(st.best, st.streak);
  st.last = dateKey;
  localStorage.setItem(STREAK_KEY, JSON.stringify(st));
  return st;
}
export function getStreak() {
  try { return JSON.parse(localStorage.getItem(STREAK_KEY)) || { streak: 0, best: 0, last: '' }; }
  catch { return { streak: 0, best: 0, last: '' }; }
}
