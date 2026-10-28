async function request(path, options) {
  const res = await fetch(path, {
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) throw new Error(`${path} returned ${res.status}`);
  return res.json();
}

export const getShops = () => request('/api/shops');
export const getBroadcasts = () => request('/api/sim/broadcasts');
export const resolveBeacon = (body) =>
  request('/api/beacons/resolve', { method: 'POST', body: JSON.stringify(body) });
