// Leaflet wrapper: locked to greater Burlington, tap-to-drop-pin.
/* global L */

const BOUNDS = L.latLngBounds([44.395, -73.30], [44.545, -73.11]);
const HOME = { center: [44.4779, -73.2000], zoom: 13 };

let map, guessMarker, truthMarker, line, onPin = null;

const pinIcon = L.divIcon({
  className: 'wib-pin',
  html: '<div style="font-size:34px;line-height:34px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))">📍</div>',
  iconSize: [34, 34], iconAnchor: [17, 32],
});
const truthIcon = L.divIcon({
  className: 'wib-truth',
  html: '<div style="font-size:32px;line-height:32px;filter:drop-shadow(0 2px 2px rgba(0,0,0,.5))">⭐</div>',
  iconSize: [32, 32], iconAnchor: [16, 28],
});

export function initMap() {
  map = L.map('map', {
    center: HOME.center, zoom: HOME.zoom,
    minZoom: 12, maxZoom: 18,
    maxBounds: BOUNDS, maxBoundsViscosity: 0.9,
    zoomControl: true, attributionControl: true,
  });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    maxZoom: 19,
  }).addTo(map);

  map.on('click', (e) => {
    if (!onPin) return;
    if (!BOUNDS.contains(e.latlng)) return;
    setGuess(e.latlng);
    onPin(e.latlng);
  });
  return map;
}

export function enablePin(cb) { onPin = cb; }
export function disablePin() { onPin = null; }

function setGuess(latlng) {
  if (guessMarker) guessMarker.setLatLng(latlng);
  else guessMarker = L.marker(latlng, { icon: pinIcon, keyboard: false }).addTo(map);
}

export function getGuess() {
  return guessMarker ? guessMarker.getLatLng() : null;
}

// draw the guess-vs-truth reveal; keeps both visible
export function showTruth(guess, truth) {
  truthMarker = L.marker(truth, { icon: truthIcon, keyboard: false }).addTo(map);
  line = L.polyline([guess, truth], { color: '#c9502f', weight: 3, dashArray: '7 7' }).addTo(map);
  map.fitBounds(L.latLngBounds([guess, truth]).pad(0.35), { maxZoom: 16 });
}

export function resetRound() {
  for (const l of [guessMarker, truthMarker, line]) if (l) map.removeLayer(l);
  guessMarker = truthMarker = line = null;
  map.setView(HOME.center, HOME.zoom, { animate: false });
}

export function invalidate() { map.invalidateSize(); }
