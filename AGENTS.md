# Where in Burlington? — agent instructions

Read `README.md` first. This is a plain static daily photo-location game:
`index.html`, `style.css`, and ES modules in `js/`; there is no build step.

## Daily integrity

The live five-photo set is deterministic from the New York date through
`dailySpots()` in `js/game.js`. Keep daily progress (`wib-state`), streaks
(`wib-streak`), results/share text, and monthly leaderboard behavior unchanged.
Leaderboard credentials in client JavaScript are public-only; never add a
service-role key or other secret.

## Duels

The ⚔️ mode is an asynchronous two-phone duel: both players independently play
the same five seed-selected photos, then compare total points and elapsed time. The
payload and winner rules live in `js/duel-game.js`. Duel photos must be drawn
from the full pool while excluding every photo in the real live daily, and duel
runs must never write daily progress, streaks, or leaderboard scores.

`js/duel.js` is vendored byte-for-byte from
`maple-scramble/js/duel.js`. `js/rooms.js` and `scripts/rooms-shim.mjs` are
vendored byte-for-byte from `four-in-a-rowboat`; change canonical copies there
and re-vendor rather than editing them here.

## Before you finish

For duel or multiplayer changes, run `node scripts/test-duel.mjs` and
`node --check` on every touched JavaScript file. If UI changed, also inspect the
game at a phone-sized viewport and report what was verified.
