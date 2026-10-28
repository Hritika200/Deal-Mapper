import { useEffect, useMemo, useRef } from 'react';
import {
  Circle,
  MapContainer,
  Marker,
  Polyline,
  TileLayer,
  Tooltip,
  useMap,
  useMapEvents,
  ZoomControl,
} from 'react-leaflet';
import L from 'leaflet';
import { categoryColor } from './theme.js';

// Shop names reach this HTML string, so escape them.
const escapeHtml = (text) =>
  String(text).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// The traveller: the avatar, a Bluetooth pulse, and a speech bubble when she reaches a door.
const walkerIcon = (walking, bubble) =>
  L.divIcon({
    className: 'walker-icon',
    html: `<div class="walker${walking ? ' is-walking' : ''}">
        <span class="walker-ring"></span>
        <img class="walker-avatar" src="/avatar.png" alt="" />
        ${bubble ? `<span class="walker-bubble">${escapeHtml(bubble)}</span>` : ''}
      </div>`,
    iconSize: [56, 56],
    iconAnchor: [28, 28],
  });

// Shops are little painted houses, like the Long Walk.
// Top picks from the guide get a star above the roof.
const shopIcon = (color, state, pick) =>
  L.divIcon({
    className: `shop-icon shop-icon--${state}${pick ? ' is-pick' : ''}`,
    html: `<svg viewBox="0 0 24 26" width="24" height="26" aria-hidden="true">
        <path d="M2 11 L12 2 L22 11 V24 H2 Z" fill="${color}" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>
        <rect x="9.5" y="15" width="5" height="9" rx="1" fill="#1d3557" opacity=".6"/>
      </svg>${pick ? '<span class="pick-star">★</span>' : ''}`,
    iconSize: [24, 26],
    iconAnchor: [12, 24],
  });

const attackIcon = L.divIcon({
  className: 'attack-icon',
  html: '<span>!</span>',
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

function ClickToMove({ onMove }) {
  useMapEvents({ click: (e) => onMove([e.latlng.lat, e.latlng.lng]) });
  return null;
}

// Start close to the traveller, at street level, with her in the open part of the map.
function StartView({ start, rightInset }) {
  const map = useMap();
  const done = useRef(false);
  useEffect(() => {
    if (done.current || !start) return;
    map.setView(start, 17.5, { animate: false });
    map.panBy([rightInset / 2, 40], { animate: false });
    done.current = true;
  }, [map, start, rightInset]);
  return null;
}

// Camera: gently glide so the traveller stays in the open part of the map
// (not under the phone or the walk controls).
function Follow({ pos, enabled, rightInset }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) return;
    const size = map.getSize();
    const cx = (size.x - rightInset) / 2;
    const cy = (size.y - 140) / 2;
    const pt = map.latLngToContainerPoint(pos);
    const dx = pt.x - cx;
    const dy = pt.y - cy;
    if (Math.hypot(dx, dy) > 40) map.panBy([dx * 0.12, dy * 0.12], { animate: false });
  }, [map, pos, enabled, rightInset]);
  return null;
}

export default function MapView({ shops, route, pos, walking, zoneState, doorState, attacks, onMove, rightInset = 0, bubble, picks = [] }) {
  const bleRangeM = 60;
  const walker = useMemo(() => walkerIcon(walking, bubble), [walking, bubble]);
  const center = useMemo(() => route[Math.floor(route.length / 2)] || [53.2718, -9.0535], [route]);

  return (
    <MapContainer center={center} zoom={17} zoomSnap={0.5} className="map" zoomControl={false} attributionControl>
      <ZoomControl position="bottomright" />
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        maxZoom={20}
      />
      <StartView start={route[0]} rightInset={rightInset} />
      <Follow pos={pos} enabled={walking} rightInset={rightInset} />
      <ClickToMove onMove={onMove} />

      <Polyline positions={route} pathOptions={{ className: 'route-line' }} />

      {shops.map((s) => {
        const inside = zoneState[s.id];
        return (
          <Circle
            key={`zone-${s.id}`}
            center={[s.lat, s.lng]}
            radius={s.zone_radius_m}
            pathOptions={{
              color: categoryColor(s.category),
              fillColor: categoryColor(s.category),
              weight: inside ? 2.5 : 1,
              opacity: inside ? 0.95 : 0.5,
              fillOpacity: inside ? 0.22 : 0.08,
            }}
            interactive={false}
          />
        );
      })}

      <Circle
        center={pos}
        radius={bleRangeM}
        pathOptions={{ className: 'ble-range' }}
        interactive={false}
      />

      {shops.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lng]}
          icon={shopIcon(categoryColor(s.category), doorState[s.id] ? 'door' : zoneState[s.id] ? 'zone' : 'idle', picks.includes(s.id))}
          keyboard={false}
        >
          <Tooltip direction="top" offset={[0, -26]}>
            <strong>{s.name}</strong>
            <br />
            {s.deal.title} <em>(demo)</em>
            {picks.includes(s.id) && (
              <>
                <br />
                One of your top picks
              </>
            )}
          </Tooltip>
        </Marker>
      ))}

      {attacks.map((a) => (
        <Marker key={a.id} position={a.at} icon={attackIcon} keyboard={false}>
          <Tooltip direction="top" offset={[0, -10]}>
            <strong>{a.label}</strong>
            <br />
            {a.mapNote}
          </Tooltip>
        </Marker>
      ))}

      <Marker
        position={pos}
        icon={walker}
        draggable
        zIndexOffset={1000}
        eventHandlers={{
          dragend: (e) => {
            const ll = e.target.getLatLng();
            onMove([ll.lat, ll.lng]);
          },
        }}
      >
        <Tooltip direction="right" offset={[30, 0]}>
          That's you. Drag me anywhere.
        </Tooltip>
      </Marker>
    </MapContainer>
  );
}
