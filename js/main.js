import {
  todayKey, msToTomorrow, dailySpots, focalPoint, haversineM, roundScore,
  fmtDist, emojiFor, loadState, saveState, bumpStreak, getStreak,
  GUESSES_PER_ROUND, ROUNDS, SOLVE_RADIUS_M,
} from './game.js';
import { initMap, enablePin, disablePin, getGuess, showTruth, resetRound, invalidate } from './map.js';
import {
  lbEnabled, getName, submitScore, renamePlayer, fetchTop, monthLabel, playerId,
} from './leaderboard.js';

const $ = (id) => document.getElementById(id);

const DATE = todayKey();
const ZOOM_SCALES = [3.4, 1.9, 1.0];

let spots = [];        // full database
let daily = [];        // today's five
let state = loadState(DATE);
let pending = null;    // latlng of unconfirmed pin

// ------------------------------------------------------------ boot

const res = await fetch('./data/spots.json');
spots = await res.json();
daily = dailySpots(spots, DATE);
initMap();

const streak = getStreak();
if (streak.streak > 0) $('introStreak').textContent = `🔥 ${streak.streak}-day streak · best ${streak.best}`;

if (state.done) {
  showResults(false);
} else {
  $('intro').classList.remove('hidden');
}

$('startBtn').addEventListener('click', () => {
  $('intro').classList.add('hidden');
  document.body.classList.add('playing');
  $('game').classList.remove('hidden');
  invalidate();
  startRound();
});

// ------------------------------------------------------------ round flow

function spotFor(i) { return daily[i]; }

function applyZoom(stageIdx, animate = true) {
  const photo = $('photo');
  const f = focalPoint(spotFor(state.round), DATE);
  photo.style.transition = animate ? '' : 'none';
  photo.style.transformOrigin = `${f.x}% ${f.y}%`;
  photo.style.transform = `scale(${ZOOM_SCALES[Math.min(stageIdx, 2)]})`;
  if (!animate) requestAnimationFrame(() => { photo.style.transition = ''; });
  const pips = $('zoomPips').children;
  for (let i = 0; i < 3; i++) {
    pips[i].className = i < stageIdx ? 'used' : i === stageIdx ? 'cur' : '';
  }
}

function startRound() {
  const spot = spotFor(state.round);
  pending = null;
  resetRound();
  enablePin(onPin);
  $('reveal').classList.add('hidden');
  $('roundLabel').textContent = `${state.round + 1} / ${ROUNDS}`;
  $('scoreLabel').textContent = `${totalScore()} pts`;
  $('photoMsg').classList.add('hidden');
  const photo = $('photo');
  photo.src = `./${spot.file}`;
  applyZoom(state.stage, false);
  showPhoto();
  updateConfirm();
}

function totalScore() {
  return state.rounds.reduce((t, r) => t + r.score, 0);
}

function onPin(latlng) {
  pending = latlng;
  updateConfirm();
}

function updateConfirm() {
  const btn = $('confirmBtn');
  const onMap = $('stage').classList.contains('show-map') || matchMedia('(min-width: 900px)').matches;
  if (pending) {
    btn.disabled = false;
    btn.textContent = `CONFIRM GUESS (${GUESSES_PER_ROUND - guessesUsed()} left)`;
  } else {
    btn.disabled = true;
    btn.textContent = onMap ? 'TAP THE MAP TO DROP A PIN' : 'DROP A PIN ON THE MAP';
  }
}

function guessesUsed() { return state.stage; }

function showPhoto() {
  $('stage').classList.remove('show-map');
  $('flipBtn').textContent = '🗺️ MAP';
  updateConfirm();
}
function showMap() {
  $('stage').classList.add('show-map');
  $('flipBtn').textContent = '📷 PHOTO';
  invalidate();
  updateConfirm();
}

$('flipBtn').addEventListener('click', () => {
  $('stage').classList.contains('show-map') ? showPhoto() : showMap();
});

$('confirmBtn').addEventListener('click', () => {
  if (!pending) { showMap(); return; }
  const spot = spotFor(state.round);
  const guess = { lat: pending.lat, lng: pending.lng };
  const d = haversineM(guess, spot);
  const solved = d <= SOLVE_RADIUS_M;
  const lastGuess = state.stage >= GUESSES_PER_ROUND - 1;

  if (solved || lastGuess) {
    finishRound(guess, d, solved);
  } else {
    // wrong-ish: zoom the photo out a stage and try again
    state.stage += 1;
    saveState(state);
    pending = null;
    const msg = $('photoMsg');
    msg.textContent = `${fmtDist(d)} away — zooming out…`;
    msg.classList.remove('hidden');
    setTimeout(() => msg.classList.add('hidden'), 2600);
    showPhoto();
    applyZoom(state.stage);
    updateConfirm();
  }
});

function finishRound(guess, d, solved) {
  const spot = spotFor(state.round);
  const score = roundScore(d, state.stage, solved);
  state.rounds.push({ d: Math.round(d), stage: state.stage, solved, score, guess });
  disablePin();
  pending = null;

  // reveal on the map: pin vs truth
  showMap();
  showTruth(guess, spot);
  applyZoom(2, true); // fully zoom out the photo for the curious

  $('revealDist').textContent = solved
    ? `📍 Found it — ${fmtDist(d)} off${state.stage === 0 ? ' at full zoom-in! (×1.5)' : state.stage === 1 ? ' (×1.2)' : ''}`
    : `😬 ${fmtDist(d)} away`;
  $('revealPts').textContent = `+${score} pts`;
  $('revealName').textContent = spot.name;
  $('revealHint').textContent = spot.hint;
  const attr = $('revealAttr');
  attr.innerHTML = '';
  attr.append('Photo: ');
  const a = document.createElement('a');
  a.href = spot.sourceUrl; a.target = '_blank'; a.rel = 'noopener';
  a.textContent = spot.author || 'Unknown';
  attr.append(a, ` · ${spot.license} · via Wikimedia Commons`);
  $('nextBtn').textContent = state.round === ROUNDS - 1 ? 'SEE RESULTS' : 'NEXT PHOTO';
  $('reveal').classList.remove('hidden');
  $('scoreLabel').textContent = `${totalScore()} pts`;

  state.stage = 0;
  state.round += 1;
  if (state.round >= ROUNDS) state.done = true;
  saveState(state);
}

$('nextBtn').addEventListener('click', () => {
  $('reveal').classList.add('hidden');
  if (state.done) showResults(true);
  else startRound();
});

// ------------------------------------------------------------ results

function showResults() {
  document.body.classList.remove('playing');
  $('game').classList.add('hidden');
  $('intro').classList.add('hidden');
  $('results').classList.remove('hidden');

  const total = totalScore();
  $('resultsDate').textContent = `Where in Burlington · ${DATE}`;
  $('totalScore').textContent = total.toLocaleString();
  $('resultsRank').textContent = rankLine(total);
  $('emojiSummary').textContent = state.rounds.map((r) => emojiFor(r.d, r.solved ? r.stage : -1)).join(' ');

  const st = bumpStreak(DATE); // idempotent per day
  $('resultsStreak').textContent = st.streak > 1
    ? `🔥 ${st.streak}-day streak · best ${st.best}` : 'Come back tomorrow to start a streak!';

  tickCountdown();
  setInterval(tickCountdown, 1000);
  updateLeaderboard(total); // guarded by state.submitted — sends exactly once
}

function rankLine(total) {
  if (total >= 6500) return 'insufferably local 🏆';
  if (total >= 5000) return 'certified Burlingtonian';
  if (total >= 3500) return 'knows their way around';
  if (total >= 2000) return 'moved here recently?';
  return 'tourist (affectionate)';
}

function tickCountdown() {
  const ms = msToTomorrow();
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000);
  $('countdown').textContent = `${h}h ${String(m).padStart(2, '0')}m ${String(s).padStart(2, '0')}s`;
}

function shareText() {
  const lines = state.rounds.map((r, i) => `${emojiFor(r.d, r.solved ? r.stage : -1)} ${fmtDist(r.d)}`);
  const st = getStreak();
  return `WHERE IN BURLINGTON? ${DATE}\n${lines.join('\n')}\n📊 ${totalScore().toLocaleString()} pts${st.streak > 1 ? ` · 🔥${st.streak}` : ''}\nhttps://btownbrief.github.io/where-in-btown/`;
}

$('shareBtn').addEventListener('click', async () => {
  const text = shareText();
  try {
    if (navigator.share) await navigator.share({ text });
    else {
      await navigator.clipboard.writeText(text);
      $('shareBtn').textContent = 'COPIED!';
      setTimeout(() => { $('shareBtn').textContent = 'SHARE RESULT'; }, 1600);
    }
  } catch { /* user cancelled */ }
});

// ------------------------------------------------------------ leaderboard
// Submitted exactly once, on completing all 5 photos (state.submitted guards
// reloads). All leaderboard UI hides itself if config is missing.

const lbBox = $('lb'), lbList = $('lbList'), lbStatus = $('lbStatus');
const lbForm = $('lbForm'), lbNameInput = $('lbNameInput');
const lbThisBtn = $('lbThisBtn'), lbLastBtn = $('lbLastBtn'), lbRenameBtn = $('lbRenameBtn');
let lbMonthOffset = 0;

if (lbEnabled()) {
  lbBox.classList.remove('hidden');
  lbThisBtn.textContent = `🏆 ${monthLabel(0)}`;
  lbLastBtn.textContent = monthLabel(-1);
}

// keep leaderboard interactions strictly inside the box
lbBox.addEventListener('click', (e) => e.stopPropagation());
lbNameInput.addEventListener('keydown', (e) => {
  e.stopPropagation();
  if (e.key === 'Enter') $('lbSaveBtn').click();
});

async function updateLeaderboard(scoreToSubmit) {
  if (!lbEnabled()) return;
  const mustSubmit = scoreToSubmit > 0 && !state.submitted;
  if (!getName()) {
    if (mustSubmit) {
      lbForm.classList.remove('hidden');
      lbRenameBtn.classList.add('hidden');
      lbStatus.textContent = 'Pick a name to join the monthly leaderboard!';
      lbList.innerHTML = '';
      lbForm.dataset.pendingScore = String(scoreToSubmit);
      return;
    }
  } else if (mustSubmit) {
    try {
      await submitScore(scoreToSubmit);
      state.submitted = true;
      saveState(state);
    } catch { /* offline — still show the board */ }
  }
  renderBoard();
}

async function renderBoard() {
  lbForm.classList.add('hidden');
  if (getName()) lbRenameBtn.classList.remove('hidden');
  lbStatus.textContent = 'Loading…';
  try {
    const rows = await fetchTop(lbMonthOffset);
    const me = playerId();
    lbList.innerHTML = '';
    rows.slice(0, 10).forEach((r, i) => {
      const li = document.createElement('li');
      if (r.player_id === me) li.className = 'me';
      const medal = ['🥇', '🥈', '🥉'][i];
      li.innerHTML = '<span class="rank"></span><span class="nm"></span><span class="sc"></span>';
      li.querySelector('.rank').textContent = medal || i + 1;
      li.querySelector('.nm').textContent = r.name;
      li.querySelector('.sc').textContent = r.score;
      lbList.appendChild(li);
    });
    const myRank = rows.findIndex((r) => r.player_id === me);
    lbStatus.textContent = rows.length === 0
      ? 'No scores yet this month — be the first!'
      : myRank >= 0 ? `You're #${myRank + 1} of ${rows.length} this month` : '';
  } catch {
    lbStatus.textContent = 'Leaderboard unavailable (offline?)';
  }
}

$('lbSaveBtn').addEventListener('click', async (e) => {
  e.stopPropagation();
  const name = lbNameInput.value.trim();
  if (!name) { lbNameInput.focus(); return; }
  const pendingScore = Number(lbForm.dataset.pendingScore || 0);
  lbForm.dataset.pendingScore = '';
  try {
    await renamePlayer(name);
    if (pendingScore > 0 && !state.submitted) {
      await submitScore(pendingScore);
      state.submitted = true;
      saveState(state);
    }
  } catch { /* offline */ }
  renderBoard();
});
lbRenameBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  lbNameInput.value = getName();
  lbForm.classList.remove('hidden');
  lbRenameBtn.classList.add('hidden');
  lbNameInput.focus();
});
lbThisBtn.addEventListener('click', () => {
  lbMonthOffset = 0;
  lbThisBtn.classList.add('sel');
  lbLastBtn.classList.remove('sel');
  renderBoard();
});
lbLastBtn.addEventListener('click', () => {
  lbMonthOffset = -1;
  lbLastBtn.classList.add('sel');
  lbThisBtn.classList.remove('sel');
  renderBoard();
});
