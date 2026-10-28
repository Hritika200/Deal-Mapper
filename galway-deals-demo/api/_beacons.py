"""Beacon security logic.

The problem: a basic Bluetooth beacon broadcasts the same ID forever. Anyone
nearby can record it and copy it onto a cheap beacon somewhere else. An app
that trusts that ID will then show the shop's deal in the wrong place.

The fix used here (similar in spirit to Google's Eddystone-EID):
  1. Rotating IDs. Each beacon broadcasts a short ID that changes every
     WINDOW_SECONDS. The ID is HMAC(shop_key, time_window), so only someone
     with the shop's secret key can produce a valid one.
  2. Server-side check. The app sends the ID it heard to the server, which
     checks it against the current and previous time window only.
  3. Location check. The app also sends its rough location. If the ID belongs
     to a shop that is far away, it was relayed or cloned, so it is rejected.

Keys never leave the server. The browser only ever sees the short rotating IDs.
"""

import hashlib
import hmac
import math
import os
import re
import time

from _data import SHOPS, SHOPS_BY_STATIC_UUID

WINDOW_SECONDS = 30          # short so the rotation is visible in a demo
ACCEPTED_WINDOWS = 2         # current + previous, to allow small clock drift
LOOKBACK_WINDOWS = 120       # used only to explain *why* an old ID failed
MAX_DISTANCE_M = 150         # how far the user can be from the shop's door
EID_PATTERN = re.compile(r"^[0-9a-f]{16}$")
UUID_PATTERN = re.compile(r"^[0-9a-f-]{36}$")

_DEV_SECRET = "dev-only-secret-change-me"
MASTER_SECRET = os.environ.get("BEACON_MASTER_SECRET", _DEV_SECRET).encode()
USING_DEV_SECRET = MASTER_SECRET == _DEV_SECRET.encode()


def _shop_key(shop_id: str) -> bytes:
    """Per-shop key derived from the master secret."""
    return hmac.new(MASTER_SECRET, f"beacon-key:{shop_id}".encode(), hashlib.sha256).digest()


def current_window(now=None) -> int:
    return int((now if now is not None else time.time()) // WINDOW_SECONDS)


def eid_for(shop_id: str, window: int) -> str:
    """The 8-byte rotating ID a shop's beacon broadcasts during a time window."""
    mac = hmac.new(_shop_key(shop_id), window.to_bytes(8, "big"), hashlib.sha256).digest()
    return mac[:8].hex()


def distance_m(lat1, lng1, lat2, lng2) -> float:
    """Great-circle distance in metres."""
    r = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dp = p2 - p1
    dl = math.radians(lng2 - lng1)
    a = math.sin(dp / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * r * math.asin(math.sqrt(a))


def simulated_broadcasts(now=None):
    """What every shop beacon is broadcasting right now.

    In real life the beacon hardware computes this itself. Here the server plays
    the part of the beacon radios so the browser has something to 'hear'.
    """
    now = now if now is not None else time.time()
    window = current_window(now)
    return {
        "window_seconds": WINDOW_SECONDS,
        "rotates_in_s": round(WINDOW_SECONDS - (now % WINDOW_SECONDS), 1),
        "broadcasts": [
            {
                "shop_id": s["id"],
                "static_uuid": s["beacon"]["static_uuid"],
                "eid": eid_for(s["id"], window),
            }
            for s in SHOPS
        ],
    }


def _match_eid(eid: str, window: int, how_many: int):
    """Return (shop, windows_ago) if eid matches a shop within the last how_many windows."""
    for ago in range(how_many):
        for shop in SHOPS:
            if hmac.compare_digest(eid_for(shop["id"], window - ago), eid):
                return shop, ago
    return None, None


def resolve_secure(eid, lat, lng, now=None):
    """Check a rotating beacon ID. Returns a result dict for the API."""
    checks = []
    if not isinstance(eid, str) or not EID_PATTERN.match(eid):
        checks.append({"name": "signed ID", "ok": False, "detail": "Not a valid rotating beacon ID."})
        return {"accepted": False, "reason": "Unsigned or malformed beacon.", "checks": checks}

    window = current_window(now)
    shop, ago = _match_eid(eid, window, ACCEPTED_WINDOWS)
    if shop is None:
        old_shop, old_ago = _match_eid(eid, window, LOOKBACK_WINDOWS)
        if old_shop is not None:
            age_s = old_ago * WINDOW_SECONDS
            checks.append({
                "name": "fresh ID", "ok": False,
                "detail": f"This ID belonged to {old_shop['name']} about {age_s} seconds ago. It has expired.",
            })
            return {"accepted": False, "reason": "Replayed old beacon ID.", "checks": checks,
                    "claimed_shop": old_shop["name"]}
        checks.append({"name": "signed ID", "ok": False, "detail": "No shop's key produces this ID."})
        return {"accepted": False, "reason": "Unknown beacon. Not signed by any registered shop.",
                "checks": checks}

    checks.append({"name": "signed ID", "ok": True, "detail": f"Signed with the key for {shop['name']}."})
    checks.append({"name": "fresh ID", "ok": True,
                   "detail": "Current time window." if ago == 0 else "Previous time window (allowed)."})

    dist = distance_m(lat, lng, shop["lat"], shop["lng"])
    if dist > MAX_DISTANCE_M:
        checks.append({
            "name": "location", "ok": False,
            "detail": f"You are roughly {round(dist, -1):.0f} m from {shop['name']}. Its real beacon can't reach that far.",
        })
        return {"accepted": False, "reason": "Cloned or relayed beacon (wrong location).",
                "checks": checks, "claimed_shop": shop["name"]}

    checks.append({"name": "location", "ok": True,
                   "detail": "Your rough location matches the shop (location is rounded to about 100 m)."})
    return {"accepted": True, "reason": "Verified beacon.", "checks": checks, "shop_id": shop["id"]}


def resolve_insecure(static_uuid):
    """How a basic beacon app works: look up the fixed ID and trust it."""
    if not isinstance(static_uuid, str) or not UUID_PATTERN.match(static_uuid):
        return {"accepted": False, "reason": "No beacon ID.", "checks": []}
    shop = SHOPS_BY_STATIC_UUID.get(static_uuid)
    if shop is None:
        return {"accepted": False, "reason": "Unknown beacon ID.", "checks": []}
    return {
        "accepted": True,
        "reason": "Matched fixed beacon ID. No other checks.",
        "checks": [{"name": "fixed ID lookup", "ok": True, "detail": "ID found. Nothing else checked."}],
        "shop_id": shop["id"],
    }
