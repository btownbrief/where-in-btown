// Shared rules for the Wednesday-edition insert (scripts/edition-insert.mjs)
// and its test. Pure: no fs, no network.
//
// Licence gate. The game's photos are Wikimedia Commons; a tight crop is a
// derivative work. The Brief will not license its own weekly feature under
// share-alike, so BY-SA photos are refused (INSERT-SPEC.md §1). BY photos
// pass with the attribution the licence requires, CC0 with a courtesy
// credit, and Stephen's own photos ("own") with none.

export const LICENCE_URLS = {
  'CC0': 'https://creativecommons.org/publicdomain/zero/1.0/',
  'CC BY 2.0': 'https://creativecommons.org/licenses/by/2.0/',
  'CC BY 3.0': 'https://creativecommons.org/licenses/by/3.0/',
  'CC BY 4.0': 'https://creativecommons.org/licenses/by/4.0/',
  'CC BY-SA 2.0': 'https://creativecommons.org/licenses/by-sa/2.0/',
  'CC BY-SA 3.0': 'https://creativecommons.org/licenses/by-sa/3.0/',
  'CC BY-SA 4.0': 'https://creativecommons.org/licenses/by-sa/4.0/',
};

export function licenceDecision(spot) {
  const lic = String(spot.license || '').trim();
  if (/^own$|btown brief|©\s*btown|all rights reserved/i.test(lic) || spot.own === true) {
    return { ok: true, kind: 'own', attribution: '' };
  }
  if (/^CC0/i.test(lic)) {
    return { ok: true, kind: 'cc0', attribution: `Photo: ${spot.author || 'Wikimedia Commons'} (CC0, cropped)` };
  }
  if (/^CC BY-SA/i.test(lic)) {
    return { ok: false, kind: 'by-sa', reason: `${lic} is share-alike: a cropped puzzle image is a derivative work and would have to be released under ${lic} itself, which the Brief does not do for its own feature (INSERT-SPEC.md §1). Use a CC BY, CC0 or your own photo.` };
  }
  if (/^CC BY(\s|$)/i.test(lic)) {
    return { ok: true, kind: 'by', attribution: `Photo: ${spot.author || 'Unknown'} via Wikimedia Commons, ${lic} (cropped)` };
  }
  if (/^(GFDL|©|all rights|unknown|)$/i.test(lic) || !lic) {
    return { ok: false, kind: 'unknown', reason: `licence "${lic || 'missing'}" is not one the insert can carry; only CC BY, CC0 or your own photos.` };
  }
  return { ok: false, kind: 'other', reason: `licence "${lic}" is not on the allow list (CC BY, CC0, own).` };
}

// puzzle id = photo file basename without extension; stable, URL-safe
export function puzzleId(spot) { return String(spot.file).split('/').pop().replace(/\.[a-z0-9]+$/i, ''); }
export function findSpot(spots, id) { return spots.find((s) => puzzleId(s) === id) || null; }

// The block, in the shape the Wednesday edition uses (INSERT-SPEC.md §4), with
// the attribution as the licence requires and a "guess, then tap to reveal"
// deep link into the game. `src` is the uploaded image URL (Beehiiv asset) or,
// before upload, the local PNG path.
export function insertHtml({ spot, id, src, date, attribution, gameUrl = 'https://btownbrief.github.io/where-in-btown/' }) {
  const link = `${gameUrl}?p=${encodeURIComponent(id)}&d=${date}&utm_source=newsletter&utm_medium=email&utm_campaign=where-in-btown`;
  const parts = [
    `<h2 data-anchor-id="where-in-btown" data-anchor-id-sync="true" data-anchor-title="Where in Btown?" data-anchor-title-sync="true">Where in Btown?</h2>`,
    `<figure data-align="center" data-alt="A zoomed-in detail of a building in Burlington" data-caption-align="center" data-src="${src}" data-width="100%" data-type="imageBlock"></figure>`,
    `<p>You have walked past this. Name the place, then <a href="${link}" target="_blank" rel="noopener">tap to reveal</a>. Hit reply with your guess and the answer, and the reason this thing is there at all, runs in next Wednesday's edition.</p>`,
  ];
  if (attribution) {
    const licUrl = LICENCE_URLS[spot.license] || '';
    const licLink = licUrl ? attribution.replace(spot.license, `<a href="${licUrl}" target="_blank" rel="noopener">${spot.license}</a>`) : attribution;
    parts.push(`<p style="font-size:12px;color:#6C7A8C;"><em>${spot.sourceUrl ? licLink.replace(spot.author, `<a href="${spot.sourceUrl}" target="_blank" rel="noopener">${spot.author}</a>`) : licLink}</em></p>`);
  }
  return parts.join('\n') + '\n';
}
