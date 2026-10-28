"""Demo data for the Galway prototype.

IMPORTANT: The businesses below are real Galway places, but every deal is made up
for this demo. None of these businesses is involved in, or endorses, this project.

Coordinates are approximate. Check each pin against the live map and adjust here
if a shop sits on the wrong side of the street.
"""

DISCLAIMER = (
    "Demo only. These are real Galway businesses, but every deal shown is made up "
    "for this prototype. None of them is involved in or endorses this project."
)

# Each shop has:
#   zone_radius_m : size of the GPS "you're nearby" zone
#   beacon        : the simulated Bluetooth beacon at the shop door.
#                   static_uuid is what a basic (insecure) beacon would broadcast forever.
SHOPS = [
    {
        "id": "brown-thomas",
        "name": "Brown Thomas",
        "category": "shopping",
        "address": "William Street",
        "lat": 53.27373, "lng": -9.05069,
        "zone_radius_m": 70,
        "deal": {"title": "20% off accessories", "detail": "Show this at the till today."},
        "beacon": {"static_uuid": "6f1c2a10-0001-4b6e-9d1a-6a1a00000001"},
    },
    {
        "id": "eason",
        "name": "Eason",
        "category": "books",
        "address": "Shop Street",
        "lat": 53.27268, "lng": -9.05190,
        "zone_radius_m": 60,
        "deal": {"title": "Buy one book, get one half price", "detail": "On all paperbacks this week."},
        "beacon": {"static_uuid": "6f1c2a10-0002-4b6e-9d1a-6a1a00000002"},
    },
    {
        "id": "mccambridges",
        "name": "McCambridge's",
        "category": "food",
        "address": "Shop Street",
        "lat": 53.27244, "lng": -9.05198,
        "zone_radius_m": 60,
        "deal": {"title": "Free coffee with any sandwich", "detail": "Until 3pm at the upstairs café."},
        "beacon": {"static_uuid": "6f1c2a10-0003-4b6e-9d1a-6a1a00000003"},
    },
    {
        "id": "griffins",
        "name": "Griffin's Bakery",
        "category": "coffee",
        "address": "Shop Street",
        "lat": 53.27229, "lng": -9.05230,
        "zone_radius_m": 60,
        "deal": {"title": "Fresh scones, 2 for €4", "detail": "Out of the oven every hour."},
        "beacon": {"static_uuid": "6f1c2a10-0004-4b6e-9d1a-6a1a00000004"},
    },
    {
        "id": "sheridans",
        "name": "Sheridans Cheesemongers",
        "category": "food",
        "address": "Churchyard Street",
        "lat": 53.27251, "lng": -9.05299,
        "zone_radius_m": 55,
        "deal": {"title": "Free tasting board", "detail": "Pick any three Irish cheeses to try."},
        "beacon": {"static_uuid": "6f1c2a10-0005-4b6e-9d1a-6a1a00000005"},
    },
    {
        "id": "galway-market",
        "name": "Galway Market",
        "category": "market",
        "address": "Church Lane, by St Nicholas'",
        "lat": 53.27231, "lng": -9.05325,
        "zone_radius_m": 80,
        "deal": {"title": "Live music at the market", "detail": "Trad session at the church gates at 1pm."},
        "beacon": {"static_uuid": "6f1c2a10-0006-4b6e-9d1a-6a1a00000006"},
    },
    {
        "id": "charlie-byrnes",
        "name": "Charlie Byrne's Bookshop",
        "category": "books",
        "address": "The Cornstore, Middle Street",
        "lat": 53.27173, "lng": -9.05226,
        "zone_radius_m": 60,
        "deal": {"title": "€2 secondhand shelf", "detail": "Extra 10% off if you buy three or more."},
        "beacon": {"static_uuid": "6f1c2a10-0007-4b6e-9d1a-6a1a00000007"},
    },
    {
        "id": "tigh-neachtain",
        "name": "Tigh Neachtain",
        "category": "food",
        "address": "Cross Street / Quay Street",
        "lat": 53.27123, "lng": -9.05338,
        "zone_radius_m": 55,
        "deal": {"title": "Trad session tonight", "detail": "Music from 9pm in the front bar."},
        "beacon": {"static_uuid": "6f1c2a10-0008-4b6e-9d1a-6a1a00000008"},
    },
    {
        "id": "coffeewerk",
        "name": "Coffeewerk + Press",
        "category": "coffee",
        "address": "Quay Street",
        "lat": 53.27088, "lng": -9.05349,
        "zone_radius_m": 55,
        "deal": {"title": "€1 off any flat white", "detail": "Before 11am, weekdays."},
        "beacon": {"static_uuid": "6f1c2a10-0009-4b6e-9d1a-6a1a00000009"},
    },
    {
        "id": "mcdonaghs",
        "name": "McDonagh's",
        "category": "food",
        "address": "Quay Street",
        "lat": 53.27043, "lng": -9.05374,
        "zone_radius_m": 60,
        "deal": {"title": "Fish and chips + drink, €12", "detail": "Takeaway counter only."},
        "beacon": {"static_uuid": "6f1c2a10-0010-4b6e-9d1a-6a1a00000010"},
    },
    {
        "id": "ard-bia",
        "name": "Ard Bia at Nimmos",
        "category": "food",
        "address": "Spanish Arch",
        "lat": 53.26962, "lng": -9.05410,
        "zone_radius_m": 60,
        "deal": {"title": "Brunch table for two held", "detail": "Walk-ins welcome before noon."},
        "beacon": {"static_uuid": "6f1c2a10-0011-4b6e-9d1a-6a1a00000011"},
    },
    {
        "id": "dela",
        "name": "Dela",
        "category": "food",
        "address": "Lower Dominick Street",
        "lat": 53.27048, "lng": -9.05684,
        "zone_radius_m": 60,
        "deal": {"title": "Early bird menu, €25", "detail": "Two courses, 5pm to 6:30pm."},
        "beacon": {"static_uuid": "6f1c2a10-0012-4b6e-9d1a-6a1a00000012"},
    },
    {
        "id": "kai",
        "name": "Kai",
        "category": "coffee",
        "address": "Sea Road",
        "lat": 53.26994, "lng": -9.06053,
        "zone_radius_m": 60,
        "deal": {"title": "Cake of the day + tea, €6", "detail": "Afternoons from 2pm."},
        "beacon": {"static_uuid": "6f1c2a10-0013-4b6e-9d1a-6a1a00000013"},
    },
]

# Walking route: Eyre Square -> Shop Street -> Latin Quarter -> Spanish Arch -> West End.
# Points are [lat, lng]. The route passes close to each shop door so the
# Bluetooth "at the door" alert can fire.
ROUTE = [
    [53.27425, -9.04965],  # Eyre Square, west side
    [53.27395, -9.05015],  # Williamsgate Street
    [53.27370, -9.05062],  # William Street, Brown Thomas
    [53.27330, -9.05115],
    [53.27300, -9.05150],  # Lynch's Castle corner
    [53.27270, -9.05182],  # Eason
    [53.27246, -9.05205],  # McCambridge's
    [53.27232, -9.05223],  # Griffin's
    [53.27238, -9.05262],  # into Churchyard Street
    [53.27248, -9.05294],  # Sheridans
    [53.27234, -9.05320],  # Galway Market
    [53.27195, -9.05302],  # Mainguard / High Street
    [53.27172, -9.05290],  # High Street
    [53.27172, -9.05232],  # Middle Street, Charlie Byrne's
    [53.27150, -9.05300],  # Cross Street
    [53.27125, -9.05332],  # Tigh Neachtain
    [53.27090, -9.05344],  # Coffeewerk + Press
    [53.27045, -9.05368],  # McDonagh's
    [53.26990, -9.05392],
    [53.26965, -9.05404],  # Spanish Arch, Ard Bia
    [53.27005, -9.05440],
    [53.27000, -9.05600],  # Wolfe Tone Bridge, west end
    [53.27045, -9.05678],  # Dela
    [53.27060, -9.05820],
    [53.27030, -9.05950],  # Sea Road
    [53.26996, -9.06051],  # Kai
]


def public_shop(shop):
    """Shop fields that are safe to send to the browser (no secrets)."""
    return {
        "id": shop["id"],
        "name": shop["name"],
        "category": shop["category"],
        "address": shop["address"],
        "lat": shop["lat"],
        "lng": shop["lng"],
        "zone_radius_m": shop["zone_radius_m"],
        "deal": shop["deal"],
        "beacon": {"static_uuid": shop["beacon"]["static_uuid"]},
    }


SHOPS_BY_ID = {s["id"]: s for s in SHOPS}
SHOPS_BY_STATIC_UUID = {s["beacon"]["static_uuid"]: s for s in SHOPS}
