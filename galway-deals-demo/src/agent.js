// "Your guide": a small learning agent that runs entirely on the device.
//
// How it learns
//   Each category (coffee, food, ...) has a Beta(likes, dislikes) score.
//   Tapping "Interested" adds a like; "Not for me" adds a dislike.
//   It starts slightly optimistic (2 likes, 1 dislike) so new users still get alerts.
//
// How it decides (epsilon-greedy bandit)
//   - Show an alert if the expected liking for its category is at least SHOW_AT.
//   - Otherwise mute it, except for a small chance (EXPLORE) of showing it anyway,
//     so the guide can notice if your taste changes.
//
// Privacy: what you like is stored only in this browser and never sent to the server.

const STORAGE_KEY = 'passing-by.guide.v1';
export const PRIOR = { a: 2, b: 1 };
export const SHOW_AT = 0.45;
export const EXPLORE = 0.1;
const SHOP_WEIGHT = 0.08;

export function emptyModel() {
  return { cats: {}, shops: {} };
}

export function loadModel() {
  try {
    const m = JSON.parse(window.localStorage.getItem(STORAGE_KEY));
    if (m && typeof m.cats === 'object' && typeof m.shops === 'object') return m;
  } catch {
    // storage blocked or empty: start fresh
  }
  return emptyModel();
}

export function saveModel(model) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(model));
  } catch {
    // private window or blocked storage: the guide still works for this visit
  }
}

export function catStats(model, cat) {
  const c = model.cats[cat] ?? { likes: 0, dislikes: 0 };
  const a = PRIOR.a + c.likes;
  const b = PRIOR.b + c.dislikes;
  return { likes: c.likes, dislikes: c.dislikes, rated: c.likes + c.dislikes, mean: a / (a + b) };
}

export function isMuted(model, cat) {
  return catStats(model, cat).mean < SHOW_AT;
}

// Return a new model with one piece of feedback added.
export function learn(model, shop, liked) {
  const prev = model.cats[shop.category] ?? { likes: 0, dislikes: 0 };
  return {
    cats: {
      ...model.cats,
      [shop.category]: liked ? { ...prev, likes: prev.likes + 1 } : { ...prev, dislikes: prev.dislikes + 1 },
    },
    shops: { ...model.shops, [shop.id]: (model.shops[shop.id] ?? 0) + (liked ? 1 : -1) },
  };
}

export function unmute(model, cat) {
  const cats = { ...model.cats };
  delete cats[cat];
  return { ...model, cats };
}

export function score(model, shop) {
  const bonus = Math.max(-2, Math.min(2, model.shops[shop.id] ?? 0)) * SHOP_WEIGHT;
  return catStats(model, shop.category).mean + bonus;
}

// Plain-English reason for a shop's score. `noun` is e.g. "coffee", "book".
export function reasonFor(model, shop, noun) {
  const s = catStats(model, shop.category);
  if (s.rated === 0) return `You haven't rated any ${noun} alerts yet.`;
  if (s.likes && !s.dislikes) return `You liked ${s.likes} ${noun} ${s.likes === 1 ? 'alert' : 'alerts'}.`;
  return `You liked ${s.likes} of ${s.rated} ${noun} alerts.`;
}

// Should this alert be shown? Returns { show, explore }.
export function decide(model, shop, random = Math.random) {
  if (score(model, shop) >= SHOW_AT) return { show: true, explore: false };
  if (random() < EXPLORE) return { show: true, explore: true };
  return { show: false, explore: false };
}

// Best places on the route for this person, among the categories they picked.
export function topPicks(model, shops, interests, count = 3) {
  return shops
    .filter((s) => interests.has(s.category) && !isMuted(model, s.category))
    .map((s) => ({ shop: s, score: score(model, s) }))
    .sort((x, y) => y.score - x.score || x.shop.name.localeCompare(y.shop.name))
    .slice(0, count);
}
