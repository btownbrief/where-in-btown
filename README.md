# Where in Burlington?

A daily GeoGuessr-style photo game for Burlington, VT — part of [Btown Games](https://www.btownbrief.com/).

Five zoomed-in local photos a day (same for everyone, resets at midnight Eastern). Drop a pin on the map; each wrong guess (>150 m off) zooms the photo out a stage and costs points. GeoGuessr-style distance scoring: 1000 pts within 25 m falling to 0 at 2 km, ×1.5 if solved fully zoomed-in.

Plain static site, no build step: `index.html` + `style.css` + `js/` ES modules. Leaflet + OpenStreetMap tiles (vendored in `vendor/`). Photos are freely-licensed images from Wikimedia Commons — see `data/spots.json` and [credits](https://btownbrief.github.io/where-in-btown/credits.html).

Monthly leaderboard shared with the other Btown Games via Supabase (`js/leaderboard.js`).

**Levels** (`?levels=1&level=N`, the 🪜 button): a ladder of 14 five-photo levels that unlock in
order. Difficulty is the zoom start (level 1 opens at 1.9×, the last levels at 4.2×, tighter than the
daily's 3.4×). Progress is local (`wib-levels`); scores are not sent to the monthly board. `js/levels.js`.

**The Wednesday insert** (`scripts/edition-insert.mjs <id> | --today`): renders one puzzle's crop at
600px with the game's own focal/zoom logic and writes a Beehiiv-ready block with a `?p=<id>&d=<date>`
"tap to reveal" deep link. It refuses share-alike photos and says why; `PHOTOS-WANTED.md` is the shot
list for licence-free replacements. `?p=<id>` opens the peek view (photo, tap to reveal, credit; nothing saved).

Dev: `python3 -m http.server` in the repo root. `?testdate=YYYY-MM-DD` plays a specific day's set.

`scripts/harvest.mjs` + `scripts/picks.mjs` were the one-time photo-database build tools.

A Btown Games production · [Read the BTown Brief →](https://www.btownbrief.com)
