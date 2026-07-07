// Curated picks from scripts/candidates.json. lat/lng are the SUBJECT's
// location (hand-verified against known addresses), which may differ from
// the photo's camera coords. Run: node scripts/picks.mjs  -> downloads
// photos/ and writes data/spots.json
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

// [commonsTitle, slug, lat, lng, name, hint]
const PICKS = [
  ['File:Flynn Theatre marquee Burlington Vermont.jpg', 'flynn', 44.47573, -73.21334, 'The Flynn', 'The 1930 art-deco marquee that anchors lower Main Street.'],
  ['File:City Hall Burlington Vermont from northeast on Church Street.jpg', 'city-hall', 44.47638, -73.21261, 'Burlington City Hall', 'Brick-and-marble 1928 McKim, Mead & White civic pile at the bottom of the Marketplace.'],
  ['File:Ethan Allen Engine Company No. 4 Burlington Vermont from Church Street.jpg', 'firehouse-gallery', 44.47663, -73.21253, 'BCA Center (old Firehouse)', 'Ethan Allen Engine Co. No. 4 rolled out of here; art hangs here now.'],
  ['File:United States Post Office and Custom House Burlington Vermont from west.jpg', 'old-post-office', 44.47580, -73.21225, 'Old Post Office & Custom House', 'Granite federal building at Main & Church, from 1906.'],
  ['File:Fletcher Free Library Burlington Vermont entrance.jpg', 'fletcher-free', 44.47705, -73.21042, 'Fletcher Free Library', 'Carnegie-funded and nearly lost to a sinking foundation in the 1970s.'],
  ['File:Memorial Auditorium Burlington Vermont.jpg', 'memorial-auditorium', 44.47610, -73.20880, 'Memorial Auditorium', 'Built 1928 to honor WWI dead; shuttered since 2016 and still argued about.'],
  ['File:Chittenden County Trust Company Building 123 Church Street Burlington Vermont.jpg', 'chittenden-trust', 44.47690, -73.21255, '123 Church Street', 'A 1928 bank temple turned Marketplace storefront.'],
  ['File:Church Street Marketplace Burlington Vermont looking south from Bank Street.jpg', 'church-st-south', 44.47810, -73.21260, 'Church Street at Bank', 'Middle block of the Marketplace, looking toward City Hall.'],
  ['File:Church Street Marketplace in autumn.jpg', 'church-st-autumn', 44.47910, -73.21260, 'Upper Church Street', 'Top block of the Marketplace in peak foliage.'],
  ["File:Henry's Diner - Burlington, Vermont.jpg", 'henrys-diner', 44.47800, -73.21350, "Henry's Diner", 'Slinging eggs on Bank Street since 1925.'],
  ['File:Ben and Jerrys Church St Burlington VT 2025-04-14 17-05-07.jpg', 'ben-jerrys', 44.47935, -73.21260, "Ben & Jerry's", "The scoop shop near where it all started (the real first one was a gas station down the hill)."],
  ['File:Leunigs Bistro front Burlington VT 2025-04-14 16-57-16.jpg', 'leunigs', 44.47710, -73.21300, "Leunig's Bistro", 'Parisian-ish corner café at Church & College.'],
  ['File:RiRa Irish Pub front Burlington VT 2025-04-13 20-27-52 1.jpg', 'rira', 44.47692, -73.21258, 'Rí Rá Irish Pub', 'Guinness in a former bank building on the Marketplace.'],
  ['File:Homeport Church St Burlington Vt 2025-04-14 17-03-30.jpg', 'homeport', 44.47870, -73.21260, 'Homeport', 'The kitchen-and-everything-else store, a Church Street fixture since 1977.'],
  ['File:A CVS Pharmacy on Church Street in Burlington, Vermont 01.jpg', 'cvs-church', 44.47920, -73.21270, 'CVS on Church Street', 'Even the chain drugstore gets a historic brick facade here.'],
  ['File:Unitarian Church Burlington Vermont.jpg', 'unitarian-church', 44.48080, -73.21260, 'First Unitarian Universalist', 'The 1816 meeting house that closes the view up Church Street.'],
  ['File:Masonic Temple - Burlington, Vermont.jpg', 'masonic-temple', 44.48020, -73.21310, 'Masonic Temple', 'Fortress-y 1898 landmark at Church & Pearl.'],
  ['File:Richardson Building Burlington Vermont.jpg', 'richardson-building', 44.48050, -73.21290, 'Richardson Building', 'Ornate 1895 department-store block at Church & Cherry.'],
  ['File:Radio Bean 8 North Winooski Avenue downtown Burlington VT July 2025 01.jpg', 'radio-bean', 44.48085, -73.21120, 'Radio Bean', 'Coffee, tiny stages, and late nights on North Winooski.'],
  ['File:The Other Place 4 North Winooski Avenue downtown Burlington VT July 2025 01.jpg', 'other-place', 44.48070, -73.21110, 'The Other Place', 'The neighborhood dive next door to the Bean.'],
  ['File:First Baptist Church - Burlington, Vermont 01.jpg', 'first-baptist', 44.47770, -73.21470, 'First Baptist Church', '1864 brick steeple on St. Paul Street.'],
  ['File:Former Immaculate Conception Cathedral - Burlington 01.jpg', 'immaculate-conception', 44.47970, -73.21490, 'Former Immaculate Conception Cathedral', 'The modernist 1977 cathedral and its famous grove of locust trees.'],
  ['File:Cathedral Church of St. Paul - Burlington, Vermont 01.jpg', 'st-pauls', 44.47980, -73.21840, 'Cathedral Church of St. Paul', 'Brutalist Episcopal cathedral rebuilt after the 1971 fire.'],
  ['File:Hotel Vermont.jpg', 'hotel-vermont', 44.47900, -73.21750, 'Hotel Vermont', 'Cherry Street boutique hotel, very Vermont about it.'],
  ['File:Judge Edward J. Costello Courthouse.jpg', 'costello-courthouse', 44.47940, -73.21700, 'Costello Courthouse', 'Where Chittenden County goes to court, on Cherry Street.'],
  ['File:Downtown Transit Center - Burlington, Vermont.jpg', 'transit-center', 44.47980, -73.21430, 'Downtown Transit Center', 'Every GMT route in the county funnels through here.'],
  ['File:John J. Zampieri State Office Building.jpg', 'zampieri-building', 44.47950, -73.21400, 'Zampieri State Office Building', 'The state government’s downtown outpost on Pearl Street.'],
  ['File:100 Bank Street - Burlington, Vermont.jpg', 'hundred-bank', 44.47830, -73.21560, '100 Bank Street', 'One of the few things downtown you could call a high-rise.'],
  ['File:Wells-Richardson building Burlington VT 2025-04-13 18-35-35 1 (cropped).jpg', 'wells-richardson', 44.47700, -73.21540, 'Wells-Richardson Building', 'A patent-medicine fortune built this College Street block.'],
  ['File:The Nest Burlington 2025 (cropped).jpg', 'the-nest', 44.47790, -73.21560, 'The Nest (CityPlace)', 'The tower that finally rose out of the famous pit.'],
  ['File:Decker Towers Burlington VT 2025.jpg', 'decker-towers', 44.47310, -73.21360, 'Decker Towers', 'Vermont’s tallest building, an 11-story housing high-rise.'],
  ['File:Armory Burlington Vermont.jpg', 'armory', 44.47590, -73.21570, 'The Armory', 'Castle-ish 1905 drill hall on lower Main Street.'],
  ['File:Edmunds School Burlington Vermont.jpg', 'edmunds', 44.47600, -73.20870, 'Edmunds School', 'The grand 1900 school building up Main Street hill.'],
  ['File:College Street Congregational Church 01.jpg', 'college-st-church', 44.47700, -73.20930, 'College Street Congregational', 'Red-brick 1866 church with the green steeple.'],
  ['File:First Congregational Church - Burlington, Vermont 01.jpg', 'first-congregational', 44.47940, -73.21050, 'First Congregational Church', 'The 1842 columned meetinghouse on South Winooski.'],
  ['File:First United Methodist Church - Burlington, Vermont 01.jpg', 'first-methodist', 44.47870, -73.21050, 'First United Methodist', 'Stone church at Buell and South Winooski.'],
  ['File:Restaurant Poco 55 Main Street downtown Burlington VT June 2025.jpg', 'poco', 44.47560, -73.21740, 'Poco', 'Small plates at the bottom of Main Street.'],
  ['File:Follett House Burlington Vermont.jpg', 'follett-house', 44.47670, -73.21800, 'Follett House', 'Greek Revival mansion staring down the lake from College Street.'],
  ['File:Union Station Burlington Vermont central section.jpg', 'union-station', 44.47570, -73.21910, 'Union Station', 'The 1916 beaux-arts depot at the foot of Main — wings on the roof.'],
  ['File:Main Street Landing Performing Arts Center Burlington Vermont.jpg', 'main-street-landing', 44.47720, -73.21930, 'Main Street Landing', 'Colorful waterfront arts building on Lake Street.'],
  ['File:Skinny Pancake restaurant front Burlington VT 2025-04-14 16-42-39 1.jpg', 'skinny-pancake', 44.47700, -73.21970, 'Skinny Pancake', 'Crêpes by the waterfront.'],
  ['File:Spirit of Ethan Allen III (6237255092).jpg', 'spirit-of-ethan-allen', 44.47670, -73.22190, 'Spirit of Ethan Allen III', 'The lake cruise boat at its Burlington Boathouse dock.'],
  ['File:BTV BatteryPark 20151118.jpg', 'battery-park', 44.48060, -73.21970, 'Battery Park', 'Cannons fired at the British from this bluff in 1813.'],
  ['File:Chief Grey Lock Sculpture BTV 20060128.jpg', 'grey-lock', 44.48170, -73.21970, 'Chief Grey Lock statue', 'The Abenaki war leader watches the lake from Battery Park.'],
  ['File:Burlington Discover Jazz Festival Waterfront Park Burlington VT June 2025 01.jpg', 'waterfront-park', 44.47890, -73.22140, 'Waterfront Park', 'Rail yard turned festival lawn on Lake Champlain.'],
  ['File:Cathedral of Saint Joseph - Burlington, Vermont 01.jpg', 'st-joseph', 44.48320, -73.21460, 'St. Joseph Co-Cathedral', 'The French-Canadian cathedral towering over Allen Street.'],
  ['File:Elmwood Cemetery - Burlington, Vermont.jpg', 'elmwood-cemetery', 44.48370, -73.21310, 'Elmwood Cemetery', 'Burlington’s oldest burying ground, 1810.'],
  ['File:North Street HD Burlington 01.JPG', 'north-street', 44.48450, -73.21970, 'North Street', 'The Old North End’s main drag.'],
  ['File:EthanAllenHomestead.JPG', 'ethan-allen-homestead', 44.50800, -73.23000, 'Ethan Allen Homestead', 'Where the Green Mountain Boy actually lived, out in the Intervale.'],
  ["File:Saint Mark's - Burlington, Vermont 01.jpg", 'st-marks', 44.50960, -73.24920, 'St. Mark’s', 'New North End parish way up North Avenue.'],
  ['File:UVM OldMillBldgSW 20150703.jpg', 'old-mill', 44.47780, -73.19880, 'UVM Old Mill', 'UVM’s oldest building; Lafayette laid the cornerstone.'],
  ['File:University of Vermont Morrill Hall.jpg', 'morrill-hall', 44.47640, -73.19830, 'UVM Morrill Hall', 'Named for the Vermont senator behind land-grant colleges.'],
  ['File:University of Vermont Williams Hall.jpg', 'williams-hall', 44.47850, -73.19900, 'UVM Williams Hall', 'The gargoyle-adjacent Romanesque science hall on the Green.'],
  ['File:University of Vermont Billings Library.jpg', 'billings-library', 44.47900, -73.19910, 'UVM Billings Library', 'H.H. Richardson designed this one — the fancy library.'],
  ['File:University of Vermont Ira Allen Chapel.jpg', 'ira-allen-chapel', 44.47980, -73.19920, 'Ira Allen Chapel', 'The campus chapel with the landmark brick tower.'],
  ['File:University of Vermont Davis Center.jpg', 'davis-center', 44.47470, -73.19650, 'UVM Davis Center', 'The student center bridging Main Street and campus.'],
  ['File:University of Vermont Royall Tyler Theatre.jpg', 'royall-tyler', 44.47740, -73.19880, 'Royall Tyler Theatre', 'UVM’s playhouse in a converted 1901 gym.'],
  ['File:University of Vermont Lafayette Statue.jpg', 'lafayette-statue', 44.48040, -73.20010, 'Lafayette Statue', 'The Marquis himself, at the top of the UVM Green.'],
  ['File:UVM ConverseHallFront 20150707.jpg', 'converse-hall', 44.47850, -73.19440, 'UVM Converse Hall', 'The Hogwarts-looking dorm on East Campus.'],
  ['File:Gutterson Fieldhouse on March 29 2023.jpg', 'gutterson', 44.46930, -73.19420, 'Gutterson Fieldhouse', 'Home ice of Catamount hockey since 1963.'],
  ['File:UVM GrasseMount 20160508.jpg', 'grasse-mount', 44.47570, -73.20300, 'Grasse Mount', 'Federal-style 1804 mansion partway up Main Street hill.'],
  ["File:World's tallest filling cabinet sculpture (15422823926).jpg", 'filing-cabinet', 44.45570, -73.21700, 'World’s Tallest Filing Cabinet', 'Bren Alvarez’s 38-drawer monument to bureaucratic delay.'],
  ["File:Saint Anthony's - Burlington, Vermont 01.jpg", 'st-anthonys', 44.45520, -73.21440, 'St. Anthony’s', 'Parish church at Flynn and Pine in the South End.'],
  ['File:Christ the King - Burlington, Vermont 01.jpg', 'christ-the-king', 44.46360, -73.20930, 'Christ the King', 'Church and school off Shelburne Road.'],
  ['File:BTV ForeverYoungTreehouse 20081015.jpg', 'treehouse', 44.45290, -73.22770, 'Oakledge Treehouse', 'The universally accessible treehouse in Oakledge Park.'],
  ['File:Lakeside Burlington VT.jpg', 'lakeside', 44.45940, -73.22080, 'Lakeside neighborhood', 'Company housing built for Queen City Cotton workers.'],
  ['File:Burlington International Airport 01.jpg', 'btv-airport', 44.46920, -73.15480, 'Burlington International Airport', 'BTV — technically in South Burlington, spiritually everywhere.'],
  ['File:South Burlington City Hall, 180 Market Street.jpg', 'sb-city-hall', 44.46570, -73.17730, 'South Burlington City Hall', 'The new downtown South Burlington built for itself on Market Street.'],
  ['File:St. John Vianney - South Burlington, Vermont 01.jpg', 'st-john-vianney', 44.46240, -73.17010, 'St. John Vianney', 'The A-frame church on Hinesburg Road.'],
  ['File:StFrancisXavierChurch 20160903.jpg', 'st-francis-xavier', 44.49660, -73.18720, 'St. Francis Xavier', 'Winooski’s twin-spired French-Canadian church.'],
  ['File:Welcome to Winooski, Vermont.jpg', 'welcome-winooski', 44.50250, -73.18210, 'Welcome to Winooski', 'The Onion City announces itself.'],
  ['File:Porter Screen Company from tracks 2020.png', 'porter-screen', 44.49250, -73.18060, 'Porter Screen Mill', 'Old Winooski mill building seen from the tracks.'],
  ['File:Winooski Falls bus stop on.a clear winter day.jpg', 'winooski-falls', 44.49030, -73.18490, 'Winooski Falls Way', 'By the falls at the bottom of the mill district.'],
  ["File:Libby's Blue Line Diner, Colchester VT (2873617940).jpg", 'libbys', 44.50360, -73.18260, 'Libby’s Blue Line Diner', 'The classic railcar diner just over the Winooski line.'],
];

const cands = JSON.parse(readFileSync(new URL('./candidates.json', import.meta.url)));
const byTitle = new Map(cands.map((c) => [c.title, c]));
mkdirSync(new URL('../photos', import.meta.url), { recursive: true });

const spots = [];
for (const [title, slug, lat, lng, name, hint] of PICKS) {
  const c = byTitle.get(title);
  if (!c) { console.error(`MISSING: ${title}`); continue; }
  const file = `${slug}.jpg`;
  const dest = new URL(`../photos/${file}`, import.meta.url);
  const { existsSync } = await import('node:fs');
  if (!existsSync(dest)) {
    let buf = null;
    for (let a = 0; a < 8; a++) {
      const res = await fetch(c.thumb, { headers: { 'User-Agent': 'WhereInBtown/1.0 (btownbrief.com)' } });
      if (res.status === 429) { await new Promise((r) => setTimeout(r, 8000 * (a + 1))); continue; }
      if (!res.ok) break;
      buf = Buffer.from(await res.arrayBuffer());
      break;
    }
    if (!buf) { console.error(`FETCH FAIL: ${title}`); continue; }
    writeFileSync(dest, buf);
    console.error(`ok ${file} (${Math.round(buf.length / 1024)}kB)`);
    await new Promise((r) => setTimeout(r, 2500));
  }
  spots.push({
    file: `photos/${file}`, lat, lng, name, hint,
    license: c.license, author: c.author || 'Unknown', sourceUrl: c.url,
  });
}
writeFileSync(new URL('../data/spots.json', import.meta.url), JSON.stringify(spots, null, 1));
console.error(`wrote ${spots.length} spots`);
