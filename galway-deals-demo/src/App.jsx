import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import MapView from './MapView.jsx';
import { getBroadcasts, getShops, resolveBeacon } from './api.js';
import { CATEGORY } from './theme.js';
import { BLE, WALK_SPEED_MS, buildRoute, coarse, distanceM, nearestAlong, pointAlong, rssiAt } from './sim.js';

const TICK_MS = 100;
const ZONE_COOLDOWN_MS = 90_000;
// A "nearby" alert waits this long (in walking time). If you reach the door
// first, you only get the door alert, so one shop never sends two alerts.
const ZONE_HOLD_S = 60;
const BUBBLE_MS = 3500;
const SPEEDS = [4, 8, 16];
const CATEGORIES = Object.entries(CATEGORY).map(([id, c]) => ({ id, ...c }));

// Attacker beacons the user can plant on the map.
const ATTACK_DEFS = {
  clone: {
    id: 'atk-clone',
    label: 'Cloned beacon',
    at: [53.2699, -9.05392], // Spanish Arch, ~280 m from the real shop
    copies: 'charlie-byrnes',
    mapNote: "A copy of Charlie Byrne's beacon, placed at Spanish Arch.",
  },
  forged: {
    id: 'atk-forged',
    label: 'Fake-deal beacon',
    at: [53.27318, -9.0513], // Shop Street, by Lynch's Castle
    eid: 'f00dfacecafe1234',
    sender: 'Galway Free Gifts',
    payload: {
      title: 'Claim your free €100 Galway voucher',
      detail: 'Tap to confirm your card details at galway-gifts.example',
    },
    mapNote: 'Broadcasts a made-up deal with a scam link.',
  },
};

let nextId = 1;
const uid = () => nextId++;
function useWideScreen() {
  const query = '(min-width: 901px)';
  const [wide, setWide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const m = window.matchMedia(query);
    const onChange = () => setWide(m.matches);
    m.addEventListener('change', onChange);
    return () => m.removeEventListener('change', onChange);
  }, []);
  return wide;
}

const clock = (t = new Date()) => t.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit' });
const clockSec = (t = new Date()) =>
  t.toLocaleTimeString('en-IE', { hour: '2-digit', minute: '2-digit', second: '2-digit' });

export default function App() {
  const [data, setData] = useState(null);
  const [loadError, setLoadError] = useState(null);

  const [pos, setPos] = useState([53.27425, -9.04965]);
  const [walking, setWalking] = useState(false);
  const [speed, setSpeed] = useState(8);
  const [mode, setMode] = useState('secure');
  const [interests, setInterests] = useState(() => new Set(CATEGORIES.map((c) => c.id)));
  const [attacks, setAttacks] = useState({ clone: null, forged: null });
  const [notifications, setNotifications] = useState([]);
  const [log, setLog] = useState([]);
  const [scanner, setScanner] = useState([]);
  const [zoneState, setZoneState] = useState({});
  const [doorState, setDoorState] = useState({});
  const [rotatesIn, setRotatesIn] = useState(null);
  const [now, setNow] = useState(() => new Date());
  const [bubble, setBubble] = useState(null);
  const [showIntro, setShowIntro] = useState(true);
  const wide = useWideScreen();

  // Refs hold values the simulation loop reads without restarting.
  const alongRef = useRef(0);
  const broadcastsRef = useRef({});
  const emaRef = useRef({});
  const visitsRef = useRef({});
  const zonesRef = useRef({});
  const simClockRef = useRef(0); // walking time in seconds (runs faster at 8x, 16x)
  const pendingZoneRef = useRef({}); // held "nearby" alerts, by shop id
  const bubbleTimer = useRef(null);
  const modeRef = useRef(mode);
  const interestsRef = useRef(interests);
  const attacksRef = useRef(attacks);
  modeRef.current = mode;
  interestsRef.current = interests;
  attacksRef.current = attacks;

  const route = useMemo(() => (data ? buildRoute(data.route) : null), [data]);
  const shops = data?.shops ?? [];

  // Load shops and route.
  useEffect(() => {
    getShops()
      .then((d) => {
        setData(d);
        setPos(d.route[0]);
      })
      .catch((e) => setLoadError(e.message));
  }, []);

  // "Listen" to the simulated beacon radios. Their IDs rotate every 30 seconds.
  useEffect(() => {
    let alive = true;
    const pull = () =>
      getBroadcasts()
        .then((b) => {
          if (!alive) return;
          broadcastsRef.current = Object.fromEntries(b.broadcasts.map((x) => [x.shop_id, x]));
          setRotatesIn(b.rotates_in_s);
        })
        .catch(() => {});
    pull();
    const t = setInterval(pull, 3000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(t);
  }, []);

  const notify = useCallback((n) => {
    setNotifications((list) => [{ id: uid(), time: clock(), ...n }, ...list].slice(0, 30));
  }, []);
  const addLog = useCallback((entry) => {
    setLog((list) => [{ id: uid(), time: clockSec(), ...entry }, ...list].slice(0, 40));
  }, []);

  const say = useCallback((text) => {
    clearTimeout(bubbleTimer.current);
    setBubble(text);
    bubbleTimer.current = setTimeout(() => setBubble(null), BUBBLE_MS);
  }, []);

  // Send a held "nearby" alert, unless the door alert already covered it.
  const releaseZoneAlert = useCallback(
    (shopId) => {
      const s = pendingZoneRef.current[shopId];
      if (!s) return;
      delete pendingZoneRef.current[shopId];
      if (!interestsRef.current.has(s.category)) return;
      notify({ kind: 'zone', category: s.category, sender: s.name, title: s.deal.title, body: `${s.address}, just around you.` });
    },
    [notify],
  );

  // Main clock: moves the walker and releases held alerts.
  useEffect(() => {
    if (!route) return;
    const t = setInterval(() => {
      const dt = TICK_MS / 1000;
      if (walking) {
        simClockRef.current += dt * speed;
        const next = Math.min(alongRef.current + WALK_SPEED_MS * speed * dt, route.length);
        alongRef.current = next;
        setPos(pointAlong(route, next));
        if (next >= route.length) setWalking(false);
      } else {
        simClockRef.current += dt; // standing still: time passes normally
      }
      for (const [id, p] of Object.entries(pendingZoneRef.current)) {
        if (simClockRef.current >= p.due) releaseZoneAlert(id);
      }
    }, TICK_MS);
    return () => clearInterval(t);
  }, [walking, speed, route, releaseZoneAlert]);

  // What happens when the phone is right at a beacon.
  const handleDoor = useCallback(
    async (beacon, p) => {
      const currentMode = modeRef.current;
      const position = coarse(p);

      // Fake-deal beacon: a basic app shows whatever the beacon says.
      if (beacon.kind === 'forged') {
        if (currentMode === 'insecure') {
          say(beacon.sender);
          notify({ kind: 'door', sender: beacon.sender, title: beacon.payload.title, body: beacon.payload.detail, fake: true });
          addLog({
            status: 'danger',
            title: `Showed a deal from "${beacon.sender}" without checking it`,
            note: "This was the attacker's beacon. Basic beacons can't prove who sent them, so the app passed a scam link straight to you.",
            checks: [],
          });
          return;
        }
        try {
          const r = await resolveBeacon({ mode: 'secure', beacon: { eid: beacon.eid }, position });
          addLog({ status: 'blocked', title: `Blocked a beacon calling itself "${beacon.sender}"`, note: r.reason, checks: r.checks });
          notify({ kind: 'blocked', title: 'Blocked a suspicious beacon near you', body: 'It was not signed by any registered shop.' });
        } catch {
          addLog({ status: 'error', title: 'Could not reach the server to check a beacon', checks: [] });
        }
        return;
      }

      // Shop beacon or a cloned copy of one.
      let payload;
      if (beacon.kind === 'clone') {
        payload = currentMode === 'secure' ? { eid: beacon.eid } : { static_uuid: beacon.static_uuid };
      } else {
        const live = broadcastsRef.current[beacon.shopId];
        if (!live) {
          addLog({ status: 'error', title: `Heard ${beacon.name} but has no beacon data yet`, checks: [] });
          return;
        }
        payload = currentMode === 'secure' ? { eid: live.eid } : { static_uuid: live.static_uuid };
      }

      try {
        const r = await resolveBeacon({ mode: currentMode, beacon: payload, position });
        if (r.accepted) {
          const shop = r.shop;
          delete pendingZoneRef.current[shop.id]; // door alert replaces the "nearby" one
          if (interestsRef.current.has(shop.category)) {
            say(shop.name);
            notify({
              kind: 'door',
              category: shop.category,
              sender: shop.name,
              title: shop.deal.title,
              body: shop.deal.detail,
              fake: beacon.kind === 'clone',
            });
          }
          if (beacon.kind === 'clone') {
            addLog({
              status: 'danger',
              title: `Accepted a copy of ${shop.name}'s beacon at Spanish Arch`,
              note: 'The real shop is about 280 m away. A basic beacon ID never changes, so a copy looks exactly like the real one.',
              checks: r.checks,
            });
          } else {
            addLog({ status: 'ok', title: `Verified ${shop.name}`, checks: r.checks });
          }
        } else {
          const isAttack = beacon.kind === 'clone';
          addLog({
            status: isAttack ? 'blocked' : 'error',
            title: isAttack ? `Blocked a copy of ${r.claimed_shop ?? 'a shop'}'s beacon` : `Rejected ${beacon.name}`,
            note: r.reason,
            checks: r.checks,
          });
          if (isAttack) notify({ kind: 'blocked', title: 'Blocked a suspicious beacon near you', body: r.reason });
        }
      } catch {
        addLog({ status: 'error', title: 'Could not reach the server to check a beacon', checks: [] });
      }
    },
    [addLog, notify, say],
  );

  // Sensing: runs every time the walker moves.
  useEffect(() => {
    if (!shops.length) return;
    const t = Date.now();

    // 1. GPS zones, worked out on the device.
    const zones = {};
    for (const s of shops) {
      const z = zonesRef.current[s.id] ?? { inside: false, last: 0 };
      const inside = distanceM(pos, [s.lat, s.lng]) <= s.zone_radius_m;
      if (inside && !z.inside && interestsRef.current.has(s.category) && t - z.last > ZONE_COOLDOWN_MS) {
        pendingZoneRef.current[s.id] = { ...s, due: simClockRef.current + ZONE_HOLD_S };
        z.last = t;
      }
      // Walked out of the zone without reaching the door: send the held alert now.
      if (!inside && z.inside) releaseZoneAlert(s.id);
      z.inside = inside;
      zonesRef.current[s.id] = z;
      zones[s.id] = inside;
    }
    setZoneState(zones);

    // 2. Bluetooth: which beacons can the phone hear, and how strongly?
    const beacons = shops.map((s) => ({ id: s.id, kind: 'shop', shopId: s.id, name: s.name, at: [s.lat, s.lng] }));
    const a = attacksRef.current;
    if (a.clone) beacons.push({ ...a.clone, kind: 'clone', name: `"${a.clone.claimsName}"` });
    if (a.forged) beacons.push({ ...a.forged, kind: 'forged', name: `"${a.forged.sender}"` });

    const heard = [];
    for (const b of beacons) {
      const d = distanceM(pos, b.at);
      if (d > BLE.leaveM) delete visitsRef.current[b.id];
      if (d > 80) {
        delete emaRef.current[b.id];
        continue;
      }
      const raw = rssiAt(d);
      const prev = emaRef.current[b.id];
      const ema = prev === undefined ? raw : prev * 0.6 + raw * 0.4;
      emaRef.current[b.id] = ema;
      if (ema < BLE.rangeDbm) continue;

      const atDoor = ema >= BLE.doorDbm;
      const live = b.kind === 'shop' ? broadcastsRef.current[b.shopId] : b;
      heard.push({
        id: b.id,
        name: b.name,
        kind: b.kind,
        distance: d,
        rssi: ema,
        atDoor,
        broadcastId: modeRef.current === 'secure' ? live?.eid : live?.static_uuid,
      });
      if (atDoor && !visitsRef.current[b.id]) {
        visitsRef.current[b.id] = true;
        handleDoor(b, pos);
      }
    }
    heard.sort((x, y) => y.rssi - x.rssi);
    setScanner(heard);
    setDoorState(Object.fromEntries(heard.filter((h) => h.kind === 'shop' && h.atDoor).map((h) => [h.id, true])));
  }, [pos, shops, handleDoor, releaseZoneAlert]);

  const moveTo = useCallback(
    (p) => {
      setWalking(false);
      setPos(p);
      if (route) alongRef.current = nearestAlong(route, p).metres;
    },
    [route],
  );

  const restart = () => {
    setWalking(false);
    alongRef.current = 0;
    visitsRef.current = {};
    zonesRef.current = {};
    pendingZoneRef.current = {};
    emaRef.current = {};
    setBubble(null);
    setNotifications([]);
    setLog([]);
    setDoorState({});
    if (route) setPos(route.points[0]);
  };

  const switchMode = (m) => {
    setMode(m);
    visitsRef.current = {}; // let beacons you're standing next to be checked again
    addLog({
      status: 'info',
      title: m === 'secure' ? 'Switched to checked beacons' : 'Switched to basic beacons',
      note:
        m === 'secure'
          ? 'Beacon IDs rotate every 30 seconds and the server checks each one.'
          : 'The app now trusts any beacon ID it hears, like most simple beacon apps.',
      checks: [],
    });
  };

  const toggleAttack = async (key) => {
    if (attacks[key]) {
      setAttacks((s) => ({ ...s, [key]: null }));
      delete visitsRef.current[ATTACK_DEFS[key].id];
      return;
    }
    const def = ATTACK_DEFS[key];
    if (key === 'clone') {
      try {
        const b = await getBroadcasts();
        const victim = b.broadcasts.find((x) => x.shop_id === def.copies);
        const victimName = shops.find((s) => s.id === def.copies)?.name ?? def.copies;
        setAttacks((s) => ({
          ...s,
          clone: { ...def, eid: victim.eid, static_uuid: victim.static_uuid, claimsName: victimName },
        }));
        addLog({
          status: 'info',
          title: `Attacker recorded ${victimName}'s beacon and copied it to Spanish Arch`,
          note: 'Walk to Spanish Arch to see what happens.',
          checks: [],
        });
      } catch {
        addLog({ status: 'error', title: 'Could not reach the server to set up the attack', checks: [] });
      }
    } else {
      setAttacks((s) => ({ ...s, forged: def }));
      addLog({
        status: 'info',
        title: 'Attacker placed a fake-deal beacon on Shop Street',
        note: "Walk past Lynch's Castle to see what happens.",
        checks: [],
      });
    }
  };

  const toggleInterest = (id) =>
    setInterests((s) => {
      const next = new Set(s);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  if (loadError) {
    return (
      <div className="load-error" role="alert">
        <h1>Can't load the demo data</h1>
        <p>The app couldn't reach the API ({loadError}).</p>
        <p>
          If you're running locally, start the backend in another terminal with <code>python api/index.py</code>, then
          reload this page.
        </p>
      </div>
    );
  }

  const plantedAttacks = Object.values(attacks).filter(Boolean);
  const finished = route && alongRef.current >= route.length;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <img className="brand-avatar" src="/avatar.png" alt="" />
          <span className="brand-name">Passing By</span>
          <span className="brand-sub">Galway prototype</span>
        </div>
        <p className="disclaimer" role="note">
          <strong>Demo only.</strong> These are real Galway businesses, but every deal here is made up. None of them is
          involved in this project.
        </p>
      </header>

      <main className="layout">
        <section className="map-wrap" aria-label="Map of Galway city centre">
          {route ? (
            <MapView
              shops={shops}
              route={route.points}
              pos={pos}
              walking={walking}
              zoneState={zoneState}
              doorState={doorState}
              attacks={plantedAttacks}
              onMove={moveTo}
              rightInset={wide ? 340 : 0}
              bubble={bubble}
            />
          ) : (
            <div className="map map--loading">Loading Galway…</div>
          )}

          <div className="walk-controls">
            <button
              className="btn btn--primary"
              onClick={() => (finished ? (restart(), setWalking(true)) : setWalking((w) => !w))}
              disabled={!route}
            >
              {walking ? 'Pause' : finished ? 'Walk again' : alongRef.current > 0 ? 'Keep walking' : 'Start walk'}
            </button>
            <div className="segmented" role="group" aria-label="Walking speed">
              {SPEEDS.map((s) => (
                <button key={s} aria-pressed={speed === s} onClick={() => setSpeed(s)}>
                  {s}×
                </button>
              ))}
            </div>
            <button className="btn" onClick={restart}>
              Restart
            </button>
            <p className="hint">Drag yourself anywhere, or click the map to jump there.</p>
          </div>

          {wide ? (
            <Phone notifications={notifications} now={now} overlay />
          ) : (
            notifications[0] && <Toast key={notifications[0].id} note={notifications[0]} />
          )}

          <ul className="legend" aria-label="Map key">
            <li><span className="key key--zone" /> GPS zone, in the shop's colour (~60 m)</li>
            <li><span className="key key--ble" /> What your phone can hear</li>
            <li><span className="key key--house" /> Shop. It jumps when you're at the door</li>
          </ul>
        </section>

        <aside className="side">
          {!wide && <Phone notifications={notifications} now={now} />}

          <section className="panel" aria-labelledby="interests-h">
            <h2 id="interests-h">Deals I want</h2>
            <div className="chips">
              {CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  className="chip"
                  style={{ '--cat': c.color, '--cat-text': c.text }}
                  aria-pressed={interests.has(c.id)}
                  onClick={() => toggleInterest(c.id)}
                >
                  {c.label}
                </button>
              ))}
            </div>
          </section>

          <Scanner heard={scanner} mode={mode} rotatesIn={rotatesIn} />

          <section className="panel" aria-labelledby="sec-h">
            <h2 id="sec-h">Can you trust a beacon?</h2>
            <div className="segmented segmented--wide" role="group" aria-label="Beacon checking">
              <button aria-pressed={mode === 'secure'} onClick={() => switchMode('secure')}>
                Checked beacons
              </button>
              <button aria-pressed={mode === 'insecure'} onClick={() => switchMode('insecure')}>
                Basic beacons
              </button>
            </div>
            <p className="panel-note">
              {mode === 'secure'
                ? 'Each beacon broadcasts an ID that changes every 30 seconds. The server checks it was signed by a real shop, is still fresh, and that you are actually near that shop.'
                : 'Each beacon broadcasts the same ID forever, and the app trusts whatever it hears. This is how many simple beacon systems work.'}
            </p>

            <h3>Try an attack</h3>
            <div className="attack-buttons">
              <button className={`btn btn--attack ${attacks.clone ? 'is-on' : ''}`} onClick={() => toggleAttack('clone')}>
                {attacks.clone ? 'Remove cloned beacon' : 'Plant a cloned beacon at Spanish Arch'}
              </button>
              <button className={`btn btn--attack ${attacks.forged ? 'is-on' : ''}`} onClick={() => toggleAttack('forged')}>
                {attacks.forged ? 'Remove fake-deal beacon' : 'Plant a fake-deal beacon on Shop Street'}
              </button>
            </div>

            <SecurityLog log={log} />
          </section>

          <details className="panel about">
            <summary>How this prototype works</summary>
            <ul>
              <li><strong>GPS zone.</strong> When you walk within about 60 m of a shop, you get a heads-up. This is worked out on your phone, so your exact location is never sent anywhere.</li>
              <li><strong>Bluetooth at the door.</strong> Each shop has a small beacon. When the signal gets strong (about 9 m away), you get the deal.</li>
              <li><strong>One alert per shop.</strong> The "nearby" alert waits up to a minute of walking. If you reach the door in that time, you only get the door alert.</li>
              <li><strong>Checking beacons.</strong> Only when a beacon needs checking does the app send its ID and a rough location (rounded to about 100 m). Nothing is stored.</li>
              <li><strong>What's simulated.</strong> Browsers can't scan for Bluetooth beacons or track you in the background. A real version would be a native phone app. Here, the walk and the beacon signals are simulated.</li>
            </ul>
          </details>
        </aside>
      </main>

      {showIntro && (
        <Intro
          onStart={() => {
            setShowIntro(false);
            setWalking(true);
          }}
          onClose={() => setShowIntro(false)}
        />
      )}
    </div>
  );
}

function Intro({ onStart, onClose }) {
  const startRef = useRef(null);
  useEffect(() => {
    startRef.current?.focus();
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="intro-backdrop">
      <div className="intro" role="dialog" aria-modal="true" aria-labelledby="intro-h">
        <img className="intro-photo" src="/quay-street.jpg" alt="Quay Street in Galway, with bunting and a busker" />
        <div className="intro-body">
          <img className="intro-avatar" src="/avatar.png" alt="" />
          <h1 id="intro-h">Wander Galway. Let the good stuff find you.</h1>
          <p>
            Walk from Eyre Square to the West End. When you pass somewhere with a deal or something on, your phone
            tells you. Get to the door and you get the details.
          </p>
          <p className="intro-small">
            The walk and the Bluetooth signals are simulated. The businesses are real, the deals are made up.
          </p>
          <div className="intro-actions">
            <button ref={startRef} className="btn btn--primary" onClick={onStart}>
              Start the walk
            </button>
            <button className="btn" onClick={onClose}>
              Look around first
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// On small screens the phone sits below the map, so the newest notification
// also flashes over the map for a few seconds.
function Toast({ note }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const t = setTimeout(() => setVisible(false), 4500);
    return () => clearTimeout(t);
  }, []);
  if (!visible) return null;
  return (
    <div
      className={`toast note note--${note.kind}`}
      style={{ '--cat': note.category ? CATEGORY[note.category].color : undefined }}
      aria-hidden="true"
    >
      <span className="note-app">
        {note.kind === 'zone' ? 'Nearby' : note.kind === 'door' ? "You're at the door" : 'Passing By'}
      </span>
      <p className="note-sender">{note.sender ?? 'Passing By'}</p>
      <p className="note-title">{note.title}</p>
    </div>
  );
}

function Phone({ notifications, now, overlay = false }) {
  return (
    <section className={`phone ${overlay ? 'phone--overlay' : ''}`} aria-label="Phone notifications">
      <div className="phone-screen">
        <div className="phone-status">
          <span>{clock(now)}</span>
          <span>Galway</span>
        </div>
        <ol className="notes" aria-live="polite">
          {notifications.length === 0 && (
            <li className="note note--empty">Deals and events you pass will show up here.</li>
          )}
          {notifications.map((n) => (
            <li
              key={n.id}
              className={`note note--${n.kind}`}
              style={{ '--cat': n.category ? CATEGORY[n.category].color : undefined }}
            >
              <div className="note-head">
                <span className="note-app">
                  {n.kind === 'zone' ? 'Nearby' : n.kind === 'door' ? "You're at the door" : 'Passing By'}
                </span>
                <span className="note-time">{n.time}</span>
              </div>
              {n.sender && <p className="note-sender">{n.sender}</p>}
              <p className="note-title">{n.title}</p>
              <p className="note-body">{n.body}</p>
              {n.fake && <p className="note-fake">This came from the attacker's beacon.</p>}
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Scanner({ heard, mode, rotatesIn }) {
  return (
    <section className="panel" aria-labelledby="scan-h">
      <h2 id="scan-h">Bluetooth scanner</h2>
      <p className="panel-note">
        Beacons your phone can hear right now, strongest first.
        {mode === 'secure' && rotatesIn != null && ` IDs rotate every 30 s (next in about ${Math.round(rotatesIn)} s).`}
      </p>
      {heard.length === 0 ? (
        <p className="empty">No beacons in range. Walk towards a shop.</p>
      ) : (
        <ul className="scan-list">
          {heard.map((h) => {
            const strength = Math.max(0, Math.min(1, (h.rssi - BLE.rangeDbm) / (-50 - BLE.rangeDbm)));
            return (
              <li key={h.id} className={`scan ${h.atDoor ? 'scan--door' : ''} ${h.kind !== 'shop' ? 'scan--attack' : ''}`}>
                <div className="scan-top">
                  <span className="scan-name">{h.name}</span>
                  <span className="scan-num">
                    <span>{Math.round(h.rssi)} dBm</span>
                    <span>{Math.round(h.distance)} m</span>
                  </span>
                </div>
                <div className="bar" aria-hidden="true">
                  <span style={{ width: `${strength * 100}%` }} />
                  <i style={{ left: `${((BLE.doorDbm - BLE.rangeDbm) / (-50 - BLE.rangeDbm)) * 100}%` }} />
                </div>
                <code className="scan-id">{h.broadcastId ?? '—'}</code>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

const STATUS_LABEL = { ok: 'Verified', blocked: 'Blocked', danger: 'Fooled', error: 'Problem', info: 'Note' };

function SecurityLog({ log }) {
  return (
    <div className="seclog">
      <h3>What the app decided</h3>
      {log.length === 0 ? (
        <p className="empty">Walk up to a shop door to see each beacon get checked.</p>
      ) : (
        <ol className="log-list">
          {log.map((e) => (
            <li key={e.id} className={`log log--${e.status}`}>
              <div className="log-head">
                <span className="log-status">{STATUS_LABEL[e.status]}</span>
                <span className="log-time">{e.time}</span>
              </div>
              <p className="log-title">{e.title}</p>
              {e.note && <p className="log-note">{e.note}</p>}
              {e.checks?.length > 0 && (
                <ul className="checks">
                  {e.checks.map((c, i) => (
                    <li key={i} className={c.ok ? 'pass' : 'fail'}>
                      <span aria-hidden="true">{c.ok ? '✓' : '✕'}</span>
                      <span className="sr-only">{c.ok ? 'Passed:' : 'Failed:'}</span> {c.detail}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
