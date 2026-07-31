// Quiet-daily procedural sound. Sound is off until the player opts in.

const ENABLED_KEY = 'wib-sound-enabled';
const MAX_VOICES = 10;

let enabled = localStorage.getItem(ENABLED_KEY) === '1';
let context = null;
let master = null;
let voices = 0;
const activeOscillators = new Set();

function audioContext() {
  const AudioContext = window.AudioContext || window.webkitAudioContext;
  if (!AudioContext) return null;
  if (!context) {
    context = new AudioContext();
    master = context.createGain();
    master.gain.value = 0.18;
    master.connect(context.destination);
  }
  if (context.state === 'suspended') void context.resume().catch(() => {});
  return context;
}

function tone(frequency, delay, duration, {
  type = 'sine', gain = 0.12, slideTo = null,
} = {}) {
  if (!enabled || voices >= MAX_VOICES) return;
  const ctx = audioContext();
  if (!ctx) return;
  const start = ctx.currentTime + delay;
  const oscillator = ctx.createOscillator();
  const envelope = ctx.createGain();
  voices += 1;
  activeOscillators.add(oscillator);
  oscillator.type = type;
  oscillator.frequency.setValueAtTime(frequency, start);
  if (slideTo) {
    oscillator.frequency.exponentialRampToValueAtTime(Math.max(30, slideTo), start + duration);
  }
  envelope.gain.setValueAtTime(0.0001, start);
  envelope.gain.exponentialRampToValueAtTime(gain, start + 0.008);
  envelope.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  oscillator.connect(envelope).connect(master);
  oscillator.addEventListener('ended', () => {
    activeOscillators.delete(oscillator);
    oscillator.disconnect();
    envelope.disconnect();
    voices = Math.max(0, voices - 1);
  }, { once: true });
  oscillator.start(start);
  oscillator.stop(start + duration + 0.02);
}

function stopAll() {
  activeOscillators.forEach((oscillator) => {
    try { oscillator.stop(); } catch { /* already stopped */ }
  });
}

const RUN_END_NOTES = {
  'insufferably local 🏆': [523, 659, 784, 1047],
  'certified Burlingtonian': [494, 622, 740, 988],
  'knows their way around': [440, 554, 659],
  'moved here recently?': [392, 494, 587],
  'tourist (affectionate)': [349, 440, 523],
};

export const sound = {
  get enabled() {
    return enabled;
  },

  setEnabled(next) {
    enabled = Boolean(next);
    localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0');
    if (enabled) audioContext();
    else stopAll();
    return enabled;
  },

  silence() {
    stopAll();
  },

  pin() {
    tone(520, 0, 0.08, { type: 'triangle', gain: 0.055, slideTo: 260 });
  },

  reveal(solved, hardSolve = false) {
    if (solved) {
      tone(440, 0, 0.18, { type: 'triangle', gain: 0.1 });
      tone(660, 0.09, 0.24, { type: 'triangle', gain: 0.11 });
      if (hardSolve) {
        tone(880, 0.2, 0.36, { type: 'sine', gain: 0.13 });
        tone(1320, 0.23, 0.3, { type: 'sine', gain: 0.055 });
      }
      return;
    }
    tone(330, 0, 0.18, { type: 'sine', gain: 0.07, slideTo: 294 });
    tone(247, 0.11, 0.2, { type: 'triangle', gain: 0.045 });
  },

  runEnd(rank) {
    const notes = RUN_END_NOTES[rank] || RUN_END_NOTES['tourist (affectionate)'];
    notes.forEach((frequency, index) => {
      tone(frequency, index * 0.1, 0.28, {
        type: 'triangle',
        gain: 0.085 + index * 0.008,
      });
    });
  },
};
