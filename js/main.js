import {
  todayKey, liveTodayKey, msToTomorrow, dailySpots, focalPoint, haversineM, roundScore,
  fmtDist, emojiFor, loadState, saveState, bumpStreak, getStreak,
  GUESSES_PER_ROUND, ROUNDS, SOLVE_RADIUS_M,
} from './game.js';
import { initMap, enablePin, disablePin, getGuess, showTruth, resetRound, invalidate } from './map.js';
import {
  lbEnabled, getName, submitScore, renamePlayer, fetchTop, monthLabel, playerId,
} from './leaderboard.js';
import {
  Duel,
  getName as duelGetName,
  savedSession as duelSavedSession,
  clearSession as duelClearSession,
} from './duel.js';
import {
  makeDuelPayload, spotsForDuel, duelPayloadToken, payloadFromDuelToken,
  sameDuelPayload, compareDuelResults,
} from './duel-game.js';
import { sound } from './audio.js';

const $ = (id) => document.getElementById(id);

const DUEL_GAME = 'where-in-btown';
const params = new URLSearchParams(location.search);
const IS_DUEL_REQUEST = params.get('duel') === '1';
const LIVE_DATE = liveTodayKey();
const DATE = todayKey();
const ZOOM_SCALES = [3.4, 1.9, 1.0];
const MAX_POINTS = ZOOM_SCALES.map((_, stage) => roundScore(0, stage, true));
const REDUCED_MOTION = matchMedia('(prefers-reduced-motion: reduce)');

let spots = [];        // full database
let daily = [];        // today's five
let duelPayload = IS_DUEL_REQUEST ? payloadFromDuelToken(params.get('spots')) : null;
let state = IS_DUEL_REQUEST
  ? { date: 'duel', round: 0, stage: 0, rounds: [], done: false, submitted: false }
  : loadState(DATE);
let pending = null;    // latlng of unconfirmed pin
let duel = null;
let duelSubmitted = false;
let duelStartedAt = 0;
let duelRunMs = 0;
let revealCountFrame = 0;
let maxPointsFrame = 0;
let routeFrame = 0;
let routeAnimation = null;
let feelTimer = 0;
let photoMsgTimer = 0;

// ------------------------------------------------------------ boot

const res = await fetch('./data/spots.json');
spots = await res.json();
const liveDaily = dailySpots(spots, LIVE_DATE);
if (IS_DUEL_REQUEST) {
  try {
    daily = spotsForDuel(spots, duelPayload, liveDaily);
  } catch {
    daily = [];
  }
} else {
  daily = dailySpots(spots, DATE);
}
initMap();
renderSoundButton();
renderRoundStrip();

const streak = getStreak();
if (!IS_DUEL_REQUEST && streak.streak > 0) {
  $('introStreak').textContent = `🔥 ${streak.streak}-day streak · best ${streak.best}`;
}

if (state.done) {
  showResults(false);
} else {
  $('intro').classList.remove('hidden');
}

$('startBtn').addEventListener('click', () => {
  if (IS_DUEL_REQUEST && !duel) return;
  if (IS_DUEL_REQUEST) {
    duelStartedAt = performance.now();
    duelRunMs = 0;
  }
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
  const challengeKey = IS_DUEL_REQUEST ? `duel:${duelPayloadToken(duelPayload)}` : DATE;
  const f = focalPoint(spotFor(state.round), challengeKey);
  photo.style.transition = animate ? '' : 'none';
  photo.style.transformOrigin = `${f.x}% ${f.y}%`;
  photo.style.transform = `scale(${ZOOM_SCALES[Math.min(stageIdx, 2)]})`;
  if (!animate) requestAnimationFrame(() => { photo.style.transition = ''; });
  const pips = $('zoomPips').children;
  for (let i = 0; i < 3; i++) {
    pips[i].className = i < stageIdx ? 'used' : i === stageIdx ? 'cur' : '';
  }
}

function scoreBand(score) {
  if (score >= 900) return 'good';
  if (score >= 450) return 'okay';
  return 'low';
}

function renderRoundStrip(animateIndex = -1) {
  const strip = $('runStrip');
  [...strip.children].forEach((segment, index) => {
    const round = state.rounds[index];
    segment.className = round ? `filled band-${scoreBand(round.score)}` : '';
    if (index === animateIndex && !REDUCED_MOTION.matches) {
      segment.classList.add('just-filled');
    }
  });
  strip.setAttribute('aria-valuenow', String(state.rounds.length));
  strip.setAttribute('aria-valuetext', `${state.rounds.length} of ${ROUNDS} rounds finished`);
}

function countText(element, from, to, duration, format, frameKey) {
  if (frameKey === 'reveal') cancelAnimationFrame(revealCountFrame);
  else cancelAnimationFrame(maxPointsFrame);
  if (REDUCED_MOTION.matches || duration <= 0) {
    element.textContent = format(to);
    return;
  }
  const started = performance.now();
  const step = (now) => {
    const progress = Math.min(1, (now - started) / duration);
    const eased = 1 - ((1 - progress) ** 3);
    element.textContent = format(Math.round(from + (to - from) * eased));
    if (progress < 1) {
      const frame = requestAnimationFrame(step);
      if (frameKey === 'reveal') revealCountFrame = frame;
      else maxPointsFrame = frame;
    }
  };
  const frame = requestAnimationFrame(step);
  if (frameKey === 'reveal') revealCountFrame = frame;
  else maxPointsFrame = frame;
}

function updateMaxPoints(stageIdx, animate = false) {
  const element = $('maxPoints');
  const current = MAX_POINTS[Math.max(0, stageIdx - 1)] || MAX_POINTS[0];
  const next = MAX_POINTS[Math.min(stageIdx, MAX_POINTS.length - 1)];
  element.classList.remove('cost-drop');
  countText(
    element,
    animate ? current : next,
    next,
    animate ? 480 : 0,
    (value) => `UP TO ${value.toLocaleString()} PTS`,
    'max',
  );
  if (animate && !REDUCED_MOTION.matches) {
    void element.offsetWidth;
    element.classList.add('cost-drop');
  }
}

function clearTransientEffects() {
  cancelAnimationFrame(revealCountFrame);
  cancelAnimationFrame(maxPointsFrame);
  revealCountFrame = 0;
  maxPointsFrame = 0;
  clearTimeout(feelTimer);
  clearTimeout(photoMsgTimer);
  cancelAnimationFrame(routeFrame);
  routeFrame = 0;
  if (routeAnimation) routeAnimation.cancel();
  routeAnimation = null;
  sound.silence();
  $('milestoneBanner').classList.remove('show');
  $('burstLayer').replaceChildren();
  $('photoMsg').classList.add('hidden');
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) return;
  clearTransientEffects();
  const latest = state.rounds[state.rounds.length - 1];
  if (!$('reveal').classList.contains('hidden') && latest) {
    $('revealPts').textContent = `+${latest.score} pts`;
  } else if (!$('maxPoints').classList.contains('hidden')) {
    updateMaxPoints(state.stage);
  }
});

function startRound() {
  clearTransientEffects();
  const spot = spotFor(state.round);
  pending = null;
  resetRound();
  enablePin(onPin);
  $('reveal').classList.add('hidden');
  $('roundLabel').textContent = `${state.round + 1} / ${ROUNDS}`;
  $('scoreLabel').textContent = `${totalScore()} pts`;
  renderRoundStrip();
  $('photoMsg').classList.add('hidden');
  $('maxPoints').classList.remove('hidden');
  updateMaxPoints(state.stage);
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
  sound.pin();
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
    if (!IS_DUEL_REQUEST) saveState(state);
    pending = null;
    const msg = $('photoMsg');
    msg.textContent = `${fmtDist(d)} away — zooming out. Up to ${MAX_POINTS[state.stage].toLocaleString()} pts now.`;
    msg.classList.remove('hidden');
    clearTimeout(photoMsgTimer);
    photoMsgTimer = setTimeout(() => msg.classList.add('hidden'), 2600);
    showPhoto();
    applyZoom(state.stage);
    updateMaxPoints(state.stage, true);
    $('announcer').textContent = `Not quite. Maximum available drops to ${MAX_POINTS[state.stage].toLocaleString()} points.`;
    updateConfirm();
  }
});

function animateTruthLine() {
  if (REDUCED_MOTION.matches) return;
  routeFrame = requestAnimationFrame(() => {
    routeFrame = 0;
    const paths = [...document.querySelectorAll('#map path[stroke-dasharray]')];
    const path = paths[paths.length - 1];
    if (!path || typeof path.getTotalLength !== 'function' || typeof path.animate !== 'function') return;
    const length = path.getTotalLength();
    routeAnimation = path.animate([
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: length },
      { strokeDasharray: `${length} ${length}`, strokeDashoffset: 0 },
    ], {
      duration: 650,
      easing: 'cubic-bezier(.22,1,.36,1)',
    });
    routeAnimation.addEventListener('finish', () => { routeAnimation = null; }, { once: true });
  });
}

function celebrateHardSolve() {
  const banner = $('milestoneBanner');
  const burst = $('burstLayer');
  clearTimeout(feelTimer);
  burst.replaceChildren();
  banner.classList.remove('show');
  void banner.offsetWidth;
  banner.classList.add('show');
  if (!REDUCED_MOTION.matches) {
    for (let index = 0; index < 18; index += 1) {
      const fleck = document.createElement('i');
      const angle = (Math.PI * 2 * index) / 18;
      const distance = 70 + (index % 3) * 22;
      fleck.style.setProperty('--x', `${Math.cos(angle) * distance}px`);
      fleck.style.setProperty('--y', `${Math.sin(angle) * distance}px`);
      fleck.style.setProperty('--delay', `${(index % 4) * 25}ms`);
      burst.appendChild(fleck);
    }
  }
  feelTimer = setTimeout(() => {
    banner.classList.remove('show');
    burst.replaceChildren();
  }, 1700);
}

function finishRound(guess, d, solved) {
  clearTimeout(photoMsgTimer);
  $('photoMsg').classList.add('hidden');
  const spot = spotFor(state.round);
  const score = roundScore(d, state.stage, solved);
  const hardSolve = solved && state.stage === 0;
  const resolvedRound = state.round;
  state.rounds.push({ d: Math.round(d), stage: state.stage, solved, score, guess });
  disablePin();
  pending = null;

  // reveal on the map: pin vs truth
  showMap();
  showTruth(guess, spot);
  animateTruthLine();
  applyZoom(2, true); // fully zoom out the photo for the curious
  $('maxPoints').classList.add('hidden');

  $('revealDist').textContent = solved
    ? `📍 Found it — ${fmtDist(d)} off${state.stage === 0 ? ' at full zoom-in! (×1.5)' : state.stage === 1 ? ' (×1.2)' : ''}`
    : `😬 ${fmtDist(d)} away`;
  const points = $('revealPts');
  points.className = `reveal-pts band-${scoreBand(score)}`;
  countText(points, 0, score, 650, (value) => `+${value} pts`, 'reveal');
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
  renderRoundStrip(resolvedRound);
  $('announcer').textContent = `${solved ? 'Found it' : 'Round over'}, ${fmtDist(d)} away. ${score} points.`;
  sound.reveal(solved, hardSolve);
  if (hardSolve) celebrateHardSolve();

  state.stage = 0;
  state.round += 1;
  if (state.round >= ROUNDS) {
    state.done = true;
    if (IS_DUEL_REQUEST) {
      duelRunMs = Math.max(1, Math.round(performance.now() - duelStartedAt));
    }
  }
  if (!IS_DUEL_REQUEST) saveState(state);
}

$('nextBtn').addEventListener('click', () => {
  clearTransientEffects();
  $('reveal').classList.add('hidden');
  if (state.done && IS_DUEL_REQUEST) finishDuelRun();
  else if (state.done) showResults(true);
  else startRound();
});

// ------------------------------------------------------------ results

function showResults(celebrate = false) {
  if (IS_DUEL_REQUEST) return;
  document.body.classList.remove('playing');
  $('game').classList.add('hidden');
  $('intro').classList.add('hidden');
  $('results').classList.remove('hidden');

  const total = totalScore();
  const rank = rankLine(total);
  $('resultsDate').textContent = `Where in Burlington · ${DATE}`;
  $('totalScore').textContent = total.toLocaleString();
  $('resultsRank').textContent = rank;
  $('emojiSummary').textContent = state.rounds.map((r) => emojiFor(r.d, r.solved ? r.stage : -1)).join(' ');

  const st = bumpStreak(DATE); // idempotent per day
  $('resultsStreak').textContent = st.streak > 1
    ? `🔥 ${st.streak}-day streak · best ${st.best}` : 'Come back tomorrow to start a streak!';

  tickCountdown();
  setInterval(tickCountdown, 1000);
  updateLeaderboard(total); // guarded by state.submitted — sends exactly once
  if (celebrate) sound.runEnd(rank);
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

// ------------------------------------------------------------ sound

function renderSoundButton() {
  const enabled = sound.enabled;
  const button = $('soundBtn');
  button.textContent = enabled ? '🔊' : '🔇';
  button.setAttribute('aria-pressed', String(enabled));
  button.setAttribute('aria-label', enabled ? 'Turn sound off' : 'Turn sound on');
  button.title = enabled ? 'Sound on' : 'Sound off';
}

$('soundBtn').addEventListener('click', () => {
  sound.setEnabled(!sound.enabled);
  renderSoundButton();
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
  if (IS_DUEL_REQUEST) return;
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
      if (!IS_DUEL_REQUEST) saveState(state);
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
  if (IS_DUEL_REQUEST) return;
  const name = lbNameInput.value.trim();
  if (!name) { lbNameInput.focus(); return; }
  const pendingScore = Number(lbForm.dataset.pendingScore || 0);
  lbForm.dataset.pendingScore = '';
  try {
    await renamePlayer(name);
    if (pendingScore > 0 && !state.submitted) {
      await submitScore(pendingScore);
      state.submitted = true;
      if (!IS_DUEL_REQUEST) saveState(state);
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

// ------------------------------------------------------------ duel mode
// The room payload carries one 32-bit seed for five photos from the full pool.
// Selection excludes the real live daily, and the same payload also seeds
// focal crops. Duel state is deliberately memory-only: every daily save,
// streak write, and leaderboard submission above is gated by
// IS_DUEL_REQUEST. Elapsed time is self-reported, matching the fleet's
// accepted friends-can-cheat-with-devtools tradeoff.

const FRIENDLY_DUEL_ERRORS = {
  not_found: 'No duel with that code — double-check the letters.',
  room_full: 'That duel already has two map mavens.',
  room_started: 'That duel already started without you.',
  not_ready: 'Friend duels are not switched on yet — check back soon!',
  offline: 'Could not reach Burlington — are you online?',
  opponent_left: 'Your rival left this map behind.',
  bad_challenge: 'That photo set is no longer available.',
};

function duelFriendly(err) {
  if (err && err.code === 'wrong_game') {
    return `That code belongs to ${String(err.detail || 'another game').replace(/-/g, ' ')}.`;
  }
  return (err && FRIENDLY_DUEL_ERRORS[err.code]) || 'The map got folded wrong — please try again.';
}

function duelActive() {
  return IS_DUEL_REQUEST && duel !== null;
}

function duelUrl(payload) {
  return `?duel=1&spots=${encodeURIComponent(duelPayloadToken(payload))}`;
}

function freshDuelPayload() {
  return makeDuelPayload(spots, dailySpots(spots, liveTodayKey()));
}

let duelPanelIntent = 'host';
let pendingDuelResult = null;

$('duelBtn').addEventListener('click', () => {
  refreshDuelRejoin();
  $('duelOverlay').classList.remove('hidden');
});
$('duelOverlayClose').addEventListener('click', () => $('duelOverlay').classList.add('hidden'));
$('hostBtn').addEventListener('click', () => openDuelPanel('host'));
$('joinBtn').addEventListener('click', () => openDuelPanel('join'));
$('opCancel').addEventListener('click', () => $('onlinePanel').classList.add('hidden'));
$('opGo').addEventListener('click', duelGo);
$('lobbyCancel').addEventListener('click', cancelDuelLobby);
$('rejoinBtn').addEventListener('click', rejoinDuel);
$('duelRematchBtn').addEventListener('click', duelPrimaryAction);
$('duelExitBtn').addEventListener('click', exitDuel);
$('opCode').addEventListener('input', () => {
  $('opCode').value = $('opCode').value.toUpperCase().replace(/[^A-Z0-9]/g, '');
});
['opName', 'opCode'].forEach((id) => $(id).addEventListener('keydown', (e) => {
  if (e.key === 'Enter') duelGo();
}));

function openDuelPanel(intent) {
  duelPanelIntent = intent;
  $('duelOverlay').classList.add('hidden');
  $('opTitle').textContent = intent === 'host' ? 'START A DUEL' : 'JOIN A DUEL';
  $('opGo').textContent = intent === 'host' ? 'GET A CODE' : 'FIND THE SPOTS';
  $('opCodeWrap').classList.toggle('hidden', intent === 'host');
  $('opError').classList.add('hidden');
  $('opName').value = $('opName').value || duelGetName();
  $('onlinePanel').classList.remove('hidden');
  (intent === 'join' && $('opName').value ? $('opCode') : $('opName')).focus();
}

async function duelGo() {
  if ($('opGo').disabled) return;
  const name = $('opName').value.trim();
  if (!name) {
    $('opError').textContent = 'Every map maven needs a name.';
    $('opError').classList.remove('hidden');
    $('opName').focus();
    return;
  }
  $('opGo').disabled = true;
  $('opError').classList.add('hidden');
  try {
    if (duelPanelIntent === 'host') {
      const d = await Duel.create({
        game: DUEL_GAME, name, payload: freshDuelPayload(),
      });
      $('onlinePanel').classList.add('hidden');
      openDuelLobby(d);
    } else {
      const code = $('opCode').value.trim();
      if (code.length !== 4) {
        $('opError').textContent = 'The duel code is four letters.';
        $('opError').classList.remove('hidden');
        $('opCode').focus();
        return;
      }
      const d = await Duel.join({ game: DUEL_GAME, code, name });
      try {
        spotsForDuel(spots, d.payload, dailySpots(spots, liveTodayKey()));
      } catch {
        await d.leave();
        const invalid = new Error('bad_challenge');
        invalid.code = 'bad_challenge';
        throw invalid;
      }
      location.href = duelUrl(d.payload);
    }
  } catch (err) {
    $('opError').textContent = duelFriendly(err);
    $('opError').classList.remove('hidden');
  } finally {
    $('opGo').disabled = false;
  }
}

function openDuelLobby(d) {
  if ($('lobby')._duel && $('lobby')._duel !== d) $('lobby')._duel.stop();
  $('lobby')._duel = d;
  $('lobbyCode').textContent = d.code;
  $('lobby').classList.remove('hidden');
  d.start({
    onChange: () => {
      if (d.status !== 'waiting') location.href = duelUrl(d.payload);
    },
    onError: () => {}, // a lobby hiccup can recover on the next poll
  });
}

function cancelDuelLobby() {
  const d = $('lobby')._duel;
  if (d) void d.leave();
  $('lobby')._duel = null;
  $('lobby').classList.add('hidden');
}

function refreshDuelRejoin() {
  const saved = duelSavedSession(DUEL_GAME);
  const btn = $('rejoinBtn');
  btn.classList.toggle('hidden', !saved || duelActive());
  if (saved) btn.textContent = `↩ REJOIN DUEL ${saved.code}`;
}

async function rejoinDuel() {
  $('rejoinBtn').disabled = true;
  try {
    const d = await Duel.resume({ game: DUEL_GAME });
    if (d.status === 'waiting') {
      $('duelOverlay').classList.add('hidden');
      openDuelLobby(d);
    } else {
      spotsForDuel(spots, d.payload, dailySpots(spots, liveTodayKey()));
      location.href = duelUrl(d.payload);
    }
  } catch (err) {
    // Flaky connections retain the saved session. Only terminal room states
    // remove the one route back to the duel.
    if (err && ['not_found', 'not_seated', 'room_started'].includes(err.code)) {
      duelClearSession(DUEL_GAME);
      refreshDuelRejoin();
    }
    $('opError').textContent = duelFriendly(err);
  } finally {
    $('rejoinBtn').disabled = false;
  }
}

function duelOpponent() {
  return duel ? (duel.others()[0] || {}) : {};
}

function renderDuelBar() {
  if (!duel) return;
  const opp = duelOpponent();
  const bar = $('duelBar');
  bar.replaceChildren();
  bar.classList.remove('hidden');
  const status = document.createElement('span');
  const who = opp.name ? `VS ${opp.name}` : 'WAITING FOR YOUR RIVAL';
  const note = opp.left && !duel.isComplete()
    ? ' — THEY LEFT'
    : duelSubmitted && !duel.isComplete() ? ' — WAITING ON THEIR PIN' : '';
  status.textContent = `⚔️ DUEL ${duel.code} · ${who}${note}`;
  const exit = document.createElement('button');
  exit.type = 'button';
  exit.textContent = 'EXIT';
  exit.addEventListener('click', exitDuel);
  bar.append(status, exit);
}

function formatDuelTime(ms) {
  const totalSeconds = Math.max(0, Math.round(Number(ms) / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  return `${minutes}:${String(totalSeconds % 60).padStart(2, '0')}`;
}

function setDuelDoneMode({ head, message = '', primary = 'hidden' }) {
  $('duelDoneHead').textContent = head;
  const rows = $('duelDoneRows');
  rows.replaceChildren();
  if (message) {
    const p = document.createElement('p');
    p.textContent = message;
    rows.appendChild(p);
  }
  $('duelRematchBtn').dataset.mode = primary;
  $('duelRematchBtn').classList.toggle('hidden', primary === 'hidden');
  $('duelRematchBtn').textContent = primary === 'retry'
    ? 'TRY SENDING AGAIN' : '↻ FIVE NEW PHOTOS';
  $('duelDone').classList.remove('hidden');
}

function showDuelWaiting() {
  setDuelDoneMode({
    head: 'PIN DROPPED 📍',
    message: 'Your score is locked in. Waiting for your rival to finish the same five photos…',
  });
}

function showDuelDeadEnd(message = 'Your rival left before both scores landed.') {
  setDuelDoneMode({ head: 'RIVAL OFF THE MAP', message });
}

function showDuelDone() {
  duel.stop();
  const mine = duel.myResult();
  const opp = duelOpponent();
  const theirs = opp.result;
  const outcome = compareDuelResults(mine, theirs);
  const tie = outcome === 0;
  $('duelDoneHead').textContent = tie
    ? 'BURLINGTON STANDOFF 🤝'
    : outcome > 0 ? 'YOU FOUND THE WIN 🏆' : `${(opp.name || 'YOUR RIVAL').toUpperCase()} WINS`;

  const rows = $('duelDoneRows');
  rows.replaceChildren();
  for (const [label, result, winner] of [
    ['You', mine, outcome >= 0],
    [opp.name || 'Rival', theirs, outcome <= 0],
  ]) {
    const row = document.createElement('div');
    row.className = `duel-row${winner ? ' win' : ''}`;
    const name = document.createElement('span');
    name.textContent = label;
    const score = document.createElement('span');
    score.className = 'duel-result';
    score.textContent = result.gaveUp
      ? 'conceded'
      : `${Number(result.points).toLocaleString()} pts · ${formatDuelTime(result.ms)}`;
    row.append(name, score);
    rows.appendChild(row);
  }
  $('duelRematchBtn').dataset.mode = 'rematch';
  $('duelRematchBtn').textContent = '↻ FIVE NEW PHOTOS';
  $('duelRematchBtn').classList.remove('hidden');
  $('duelDone').classList.remove('hidden');
}

async function duelSubmit(result) {
  duelSubmitted = true;
  pendingDuelResult = result;
  renderDuelBar();
  showDuelWaiting();
  try {
    await duel.submitResult(result);
  } catch (err) {
    if (err && err.code === 'opponent_left') {
      showDuelDeadEnd();
      return false;
    }
    duelSubmitted = false;
    setDuelDoneMode({
      head: 'SCORE STUCK IN TRAFFIC',
      message: duelFriendly(err),
      primary: 'retry',
    });
    return false;
  }
  if (duel.isComplete()) showDuelDone();
  return true;
}

function finishDuelRun() {
  if (!duelActive() || duelSubmitted) return;
  document.body.classList.remove('playing');
  $('game').classList.add('hidden');
  void duelSubmit({ points: totalScore(), ms: duelRunMs });
}

async function bootDuel() {
  if (!IS_DUEL_REQUEST) return;
  $('duelBtn').classList.add('hidden');
  $('startBtn').disabled = true;
  $('startBtn').textContent = 'FINDING YOUR DUEL…';
  $('introSub').textContent = 'Loading the exact same five mystery photos on both phones.';
  try {
    duel = await Duel.resume({ game: DUEL_GAME });
  } catch (err) {
    if (err && ['not_found', 'not_seated', 'room_started'].includes(err.code)) {
      duelClearSession(DUEL_GAME);
    }
    location.replace(location.pathname);
    return;
  }

  let roomDaily;
  try {
    roomDaily = spotsForDuel(spots, duel.payload, dailySpots(spots, liveTodayKey()));
  } catch {
    showDuelDeadEnd('This photo set is no longer safe to play because it overlaps today’s live round.');
    return;
  }
  if (!sameDuelPayload(duelPayload, duel.payload)) {
    location.replace(duelUrl(duel.payload));
    return;
  }
  duelPayload = duel.payload;
  daily = roomDaily;

  if (duel.status === 'waiting') {
    $('intro').classList.add('hidden');
    openDuelLobby(duel);
    return;
  }

  $('introSub').textContent = 'Five shared Burlington photos. Most points wins; tied scores go to the faster finish.';
  $('startBtn').textContent = 'START THE DUEL';
  $('startBtn').disabled = false;
  duelSubmitted = duel.myResult() !== null;
  renderDuelBar();
  duel.start({
    onChange: () => {
      if (!sameDuelPayload(duelPayload, duel.payload)) {
        location.replace(duelUrl(duel.payload));
        return;
      }
      renderDuelBar();
      if (duel.isComplete()) showDuelDone();
      else if (duelOpponent().left) showDuelDeadEnd();
    },
    onError: (err) => {
      if (err && ['not_found', 'not_seated', 'room_started'].includes(err.code)) {
        duelClearSession(DUEL_GAME);
        location.replace(location.pathname);
      }
    },
  });

  if (duel.isComplete()) {
    $('intro').classList.add('hidden');
    showDuelDone();
  } else if (duelOpponent().left) {
    $('intro').classList.add('hidden');
    showDuelDeadEnd();
  } else if (duelSubmitted) {
    $('intro').classList.add('hidden');
    showDuelWaiting();
  }
}

async function duelPrimaryAction() {
  if ($('duelRematchBtn').dataset.mode === 'retry') {
    if (pendingDuelResult) await duelSubmit(pendingDuelResult);
  } else {
    await duelRematch();
  }
}

async function duelRematch() {
  if (!duel) return;
  $('duelRematchBtn').disabled = true;
  try {
    await duel.rematch(freshDuelPayload());
    location.href = duelUrl(duel.payload);
  } catch (err) {
    setDuelDoneMode({
      head: 'NEW PHOTOS GOT LOST',
      message: duelFriendly(err),
      primary: 'rematch',
    });
    $('duelRematchBtn').disabled = false;
  }
}

async function exitDuel() {
  if (!duel) {
    location.replace(location.pathname);
    return;
  }
  if (!duel.myResult() && duel.status !== 'waiting') {
    const elapsed = duelStartedAt
      ? Math.max(1, Math.round(performance.now() - duelStartedAt)) : 1;
    try {
      await duel.submitResult({ points: 0, ms: elapsed, gaveUp: true });
    } catch (err) {
      // An offline concede keeps the saved session rejoinable; the player
      // still gets the promised path back to the daily.
      if (err && ['opponent_left', 'not_found', 'not_seated', 'room_started'].includes(err.code)) {
        duelClearSession(DUEL_GAME);
      }
      duel.stop();
      location.replace(location.pathname);
      return;
    }
  }
  duel.stop();
  duelClearSession(DUEL_GAME);
  location.replace(location.pathname);
}

void bootDuel();
refreshDuelRejoin();
