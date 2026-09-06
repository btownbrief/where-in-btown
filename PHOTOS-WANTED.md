# Photos wanted: 20 downtown details to shoot this week

Why: the game's 74 photos are Wikimedia Commons, and 51 of them are share-alike, so the Wednesday
newsletter insert can only use 23 of them (`node scripts/edition-insert.mjs --list`). Your own photos
carry no licence at all, and they let the insert do what the Wikimedia set can't: tight close-ups of
small permanent details rather than whole buildings (INSERT-SPEC.md §1).

**How to shoot for a good puzzle**
- Phone, 1× lens (not the wide), shoot **wide and level** with the detail dead centre; the script crops
  to 1.9× around a focal point, so leave room on every side. Keep the full frame: it is the reveal.
- Fill the frame with one architectural element plus one contextual crumb (a sliver of brick, a bit of
  sky, a rail). No legible signs, house numbers or logos in the crop unless the words are the puzzle.
- Overcast light or open shade. Hard sun flattens carved stone and blows out white trim.
- Eye level to 8 feet up is where the unlooked-at things live. Shoot from the public sidewalk only.
- One two-hour walk should yield 12 to 15 usable frames. Twenty below gives a quarter's buffer.
- File them as `photos/own/<slug>.jpg` with a row in `data/spots.json` like the others but
  `"license": "own", "author": "Steve Davis", "sourceUrl": ""`. The insert script then emits no credit.

Bearings are compass directions **you face**; angles are where to stand relative to the detail.
Anything marked `[CONFIRM]` was written from memory of the street, not checked on site.

| # | Spot | The detail to frame | Where to stand / bearing | Why it puzzles well |
|---|---|---|---|---|
| 1 | **Masonic Temple**, Church & Pearl (1898) | The carved stone lintel and the compass-and-square above the Church St entrance | From the west sidewalk of Church St, face E, 45° up | Everyone walks under it; nobody has read it |
| 2 | **Fletcher Free Library**, College St | A single terracotta lion head / cornice bracket on the 1904 facade | North sidewalk of College, face S, long shot then crop | Carnegie money in one ornament |
| 3 | **City Hall**, Church St | The bronze lamp bracket or the carved "1928" datestone at the Church St steps `[CONFIRM datestone wording]` | Church St bricks, face E | Civic, permanent, ignored |
| 4 | **City Hall Park fountain** | The fountain's bowl edge with water and one lamp post behind | From the SE path, face NW | Recognisable only if you've sat there |
| 5 | **Howard Opera House**, Church & Bank (1879) | The upper-floor window hood moulding, one window only | From the Bank St side, face N, 45° up | The block everyone shops under, never looks up |
| 6 | **Richardson Building**, Church & Bank | The corner turret's slate and copper, from below | Corner of Church & Bank, face NE | One of the few turrets downtown |
| 7 | **First Unitarian Church** (1816), top of Church St | The clock face numerals, or one column base at the portico | Middle of Church St looking N, then tighten | Instantly known wide, oddly hard tight |
| 8 | **Flynn** marquee, Main St | The underside of the marquee: bulb sockets and the neon return | Main St sidewalk under the marquee, face up | Everyone has stood under it in a queue |
| 9 | **Chittenden Trust / Burlington Savings Bank** clock, Church St | The clock's face rim and one hand | From across Church St, face W `[CONFIRM the clock is still mounted]` | A civic timepiece nobody checks anymore |
| 10 | **Union Station** (Main St at the waterfront) | The "Whistling Winds" mural detail, or the station's roof-line bracket | Lake St, face E | The waterfront's one grand building |
| 11 | **ECHO / Leahy Center** | The lake-facing rail and one porthole-style window | Waterfront path, face W | Modern, but only one place has that curve |
| 12 | **Battery Park cannon** | The muzzle and one wheel spoke, lake behind | From the park lawn, face W | The 1812 story in the reveal |
| 13 | **Henry's Diner**, Bank St (1925) | The stainless corner trim and one letter of the sign (not the whole word) | Bank St sidewalk, face S | Deco you have eaten under |
| 14 | **Vermont Pub & Brewery / the old Fire Station**, College & St Paul | Carved stone above the arched doorway | St Paul St, face E | Ghost of a firehouse |
| 15 | **Old Firehouse Gallery** (BCA Center), Church St | The arched doorway keystone and one brick course | Church St, face E, straight on | A firehouse people call a gallery |
| 16 | **The Edmunds School** stone entrance, Main St | Carved school name letters, one word only | Main St sidewalk, face N | A public school on the main drag |
| 17 | **Cathedral of St Joseph**, Allen St `[CONFIRM public sidewalk sightline]` | One stained-glass window's stone tracery, exterior | Allen St, face N | Old North End edge; rotation rule |
| 18 | **Winooski Ave / Pearl St bootscraper or hitching post** `[CONFIRM one survives; several did on Pearl]` | The iron scraper set in the granite step | Kneel on the sidewalk, face the step | The whole editorial idea in one object |
| 19 | **Church Street Marketplace** brick pattern at the Pearl St entrance | The medallion / compass set in the paving | Straight down from standing height | Under everyone's feet |
| 20 | **Pine Street ghost sign** (South End) `[CONFIRM which wall; there are two or three fading painted signs between Maple and Howard]` | Two or three letters of the painted sign, brick showing through | Across Pine St, face E or W, morning light | Words as the puzzle, allowed by the spec |

Rotation (INSERT-SPEC §2): in any four-week run, roughly two downtown, one Old North End (17, 18), one
South End or waterfront (10, 11, 12, 20).

The courtesy note for a business whose building is featured is in the arcade kit's `COPY.md`.
