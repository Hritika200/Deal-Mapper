// Geometry and Bluetooth signal simulation. Everything here runs on the device:
// the GPS position never leaves the browser except as a rounded value when a
// beacon needs checking.

export const WALK_SPEED_MS = 1.4; // normal walking pace, metres per second

// Bluetooth model (log-distance path loss). Numbers are typical for a BLE beacon.
export const BLE = {
  txPowerAt1m: -59, // dBm measured 1 m from the beacon
  pathLoss: 2.2, // how quickly signal fades outdoors in a street
  rangeDbm: -98, // weaker than this: phone can't hear it (~60 m)
  // Alert distance. Stronger than this: the phone alerts you (-88 dBm is about 20 m).
  // To change it: -84 is about 13 m, -88 about 20 m, -92 about 30 m.
  doorDbm: -88,
  leaveM: 40, // walk this far away and the visit resets (keep it well above the alert distance)
  noiseDbm: 2, // random jitter, like a real radio
};

export function distanceM(a, b) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(b[0] - a[0]);
  const dLng = toRad(b[1] - a[1]);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

// Precompute cumulative distance along the route so we can find "position after X metres".
export function buildRoute(points) {
  const cumulative = [0];
  for (let i = 1; i < points.length; i++) {
    cumulative.push(cumulative[i - 1] + distanceM(points[i - 1], points[i]));
  }
  return { points, cumulative, length: cumulative[cumulative.length - 1] };
}

export function pointAlong(route, metres) {
  const { points, cumulative, length } = route;
  if (metres <= 0) return points[0];
  if (metres >= length) return points[points.length - 1];
  let i = 1;
  while (cumulative[i] < metres) i++;
  const t = (metres - cumulative[i - 1]) / (cumulative[i] - cumulative[i - 1]);
  const [a, b] = [points[i - 1], points[i]];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

// Closest distance along the route to a given point (used when the walker is dragged
// back onto the route and the user presses play).
export function nearestAlong(route, p) {
  let best = { metres: 0, gap: Infinity };
  const steps = Math.ceil(route.length / 2);
  for (let k = 0; k <= steps; k++) {
    const m = (k / steps) * route.length;
    const gap = distanceM(pointAlong(route, m), p);
    if (gap < best.gap) best = { metres: m, gap };
  }
  return best;
}

function gaussian() {
  const u = 1 - Math.random();
  const v = Math.random();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

export function rssiAt(distance) {
  const d = Math.max(distance, 0.5);
  return BLE.txPowerAt1m - 10 * BLE.pathLoss * Math.log10(d) + gaussian() * BLE.noiseDbm;
}

// Location sent to the server is rounded to about 100 m, so the server
// can check "are you near this shop?" without learning your exact spot.
export function coarse(p) {
  return { lat: Math.round(p[0] * 1000) / 1000, lng: Math.round(p[1] * 1000) / 1000 };
}
