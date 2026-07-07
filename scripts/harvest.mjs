// One-time build tool: harvest geotagged, freely-licensed candidate photos
// around Burlington VT from the Wikimedia Commons API. Outputs
// scripts/candidates.json for manual curation into data/spots.json.
// Not shipped to the site; run with: node scripts/harvest.mjs

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'WhereInBtown/1.0 (btownbrief.com; game photo curation)';

const CENTERS = [
  [44.4759, -73.2121], // downtown Burlington
  [44.4785, -73.2220], // waterfront
  [44.4779, -73.1965], // UVM
  [44.4914, -73.1857], // Winooski
  [44.4669, -73.1710], // South Burlington
  [44.4900, -73.2200], // Old North End
  [44.4550, -73.2100], // South End
  [44.5050, -73.2450], // North Beach / New North End
];

const ALLOWED = /^(cc-by(-sa)?-[0-9.]+.*|cc0|pd.*|public domain.*|cc-by(-sa)?)$/i;

async function api(params) {
  const url = `${API}?${new URLSearchParams({ format: 'json', origin: '*', ...params })}`;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status === 429 && attempt < 6) {
      const wait = 5000 * (attempt + 1);
      console.error(`429, backing off ${wait}ms`);
      await new Promise((r) => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`${res.status} for ${url.slice(0, 120)}`);
    return res.json();
  }
}

const files = new Map(); // title -> {lat,lng,dist}

for (const [lat, lng] of CENTERS) {
  const j = await api({
    action: 'query', list: 'geosearch', gsnamespace: '6',
    gscoord: `${lat}|${lng}`, gsradius: '3000', gslimit: '500',
  });
  for (const g of j.query?.geosearch || []) {
    if (!files.has(g.title)) files.set(g.title, { lat: g.lat, lng: g.lon });
  }
  await new Promise((r) => setTimeout(r, 300));
}
console.error(`geosearch: ${files.size} unique files`);

// pull imageinfo + extmetadata in batches of 50
const titles = [...files.keys()];
const out = [];
for (let i = 0; i < titles.length; i += 50) {
  const batch = titles.slice(i, i + 50);
  const j = await api({
    action: 'query', prop: 'imageinfo', titles: batch.join('|'),
    iiprop: 'url|size|extmetadata',
    iiurlwidth: '1280',
  });
  for (const page of Object.values(j.query?.pages || {})) {
    const ii = page.imageinfo?.[0];
    if (!ii) continue;
    const em = ii.extmetadata || {};
    const lic = (em.LicenseShortName?.value || '').trim();
    const licId = (em.License?.value || '').trim();
    if (!ALLOWED.test(licId) && !/^(CC BY|CC BY-SA|CC0|Public domain)/i.test(lic)) continue;
    if (ii.width < 900) continue;
    if (!/\.(jpe?g|png)$/i.test(page.title)) continue;
    const coord = files.get(page.title);
    out.push({
      title: page.title,
      lat: coord.lat, lng: coord.lng,
      width: ii.width, height: ii.height,
      license: lic,
      author: (em.Artist?.value || '').replace(/<[^>]*>/g, '').trim().slice(0, 120),
      date: (em.DateTimeOriginal?.value || '').slice(0, 40),
      desc: (em.ImageDescription?.value || '').replace(/<[^>]*>/g, '').trim().slice(0, 300),
      categories: (em.Categories?.value || '').slice(0, 300),
      thumb: ii.thumburl,
      url: ii.descriptionurl,
    });
  }
  console.error(`imageinfo ${i + batch.length}/${titles.length} -> kept ${out.length}`);
  await new Promise((r) => setTimeout(r, 1500));
}

const { writeFileSync } = await import('node:fs');
writeFileSync(new URL('./candidates.json', import.meta.url), JSON.stringify(out, null, 1));
console.error(`wrote ${out.length} candidates`);
