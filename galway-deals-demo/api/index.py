"""Flask API for the Galway deals prototype.

Runs locally with:  python api/index.py
Runs on Vercel as a Python serverless function (see vercel.json).
"""

import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from flask import Flask, jsonify, request  # noqa: E402

from _beacons import (  # noqa: E402
    USING_DEV_SECRET,
    resolve_insecure,
    resolve_secure,
    simulated_broadcasts,
)
from _data import DISCLAIMER, ROUTE, SHOPS, SHOPS_BY_ID, public_shop  # noqa: E402

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 4 * 1024  # requests are tiny; reject anything big


@app.after_request
def security_headers(resp):
    resp.headers["Cache-Control"] = "no-store"
    resp.headers["X-Content-Type-Options"] = "nosniff"
    return resp


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/shops")
def shops():
    return jsonify({
        "disclaimer": DISCLAIMER,
        "shops": [public_shop(s) for s in SHOPS],
        "route": ROUTE,
    })


@app.get("/api/sim/broadcasts")
def broadcasts():
    return jsonify(simulated_broadcasts())


def _number(value, low, high):
    if isinstance(value, bool) or not isinstance(value, (int, float)):
        return None
    return float(value) if low <= value <= high else None


@app.post("/api/beacons/resolve")
def resolve():
    """The app heard a beacon at the door. Should it trust it?

    Body: {"mode": "secure"|"insecure",
           "beacon": {"eid": "...", "static_uuid": "..."},
           "position": {"lat": 53.27, "lng": -9.05}}   # rounded by the app
    Location is used for this check only. It is not stored or logged.
    """
    body = request.get_json(silent=True)
    if not isinstance(body, dict):
        return jsonify({"error": "Send a JSON body."}), 400

    mode = body.get("mode")
    beacon = body.get("beacon") if isinstance(body.get("beacon"), dict) else {}

    if mode == "insecure":
        result = resolve_insecure(beacon.get("static_uuid"))
    elif mode == "secure":
        pos = body.get("position") if isinstance(body.get("position"), dict) else {}
        lat = _number(pos.get("lat"), -90, 90)
        lng = _number(pos.get("lng"), -180, 180)
        if lat is None or lng is None:
            return jsonify({"error": "position.lat and position.lng are required."}), 400
        result = resolve_secure(beacon.get("eid"), lat, lng)
    else:
        return jsonify({"error": "mode must be 'secure' or 'insecure'."}), 400

    shop = SHOPS_BY_ID.get(result.pop("shop_id", None))
    if shop:
        result["shop"] = public_shop(shop)
    return jsonify(result)


if __name__ == "__main__":
    if USING_DEV_SECRET:
        print("Using the built-in dev secret. Set BEACON_MASTER_SECRET before deploying.")
    app.run(host="127.0.0.1", port=int(os.environ.get("PORT", 5000)), debug=True)
