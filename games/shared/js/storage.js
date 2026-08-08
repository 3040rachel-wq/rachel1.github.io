// sessionStorage-backed "don't repeat a puzzle until you've seen them all"
// helper for the content-driven games (Crossclimb, Pinpoint, Wend), plus a
// tiny localStorage wrapper for simple persistent stats (streaks, etc.).
//
// Merely *referencing* window.sessionStorage/localStorage throws a
// SecurityError in some real contexts (Safari private browsing, sandboxed
// iframes without allow-same-origin, strict privacy settings, data: URLs)
// — it's not limited to .getItem()/.setItem() failing, the property
// access itself can throw. Every accessor below goes through
// safeStorage(), and every call site is wrapped, so a page in one of
// those contexts degrades to an in-memory, page-lifetime fallback
// instead of crashing the game.

const NS = 'li-games';
const memoryFallback = new Map();

function safeStorage(kind) {
  try {
    const s = kind === 'session' ? window.sessionStorage : window.localStorage;
    // Some browsers expose the property but throw on first real use
    // (e.g. quota probes); a cheap read/write round-trip flushes that out.
    const probeKey = `${NS}:__probe__`;
    s.setItem(probeKey, '1');
    s.removeItem(probeKey);
    return s;
  } catch {
    return null;
  }
}

function readJSON(kind, key, fallback) {
  const storage = safeStorage(kind);
  if (!storage) return memoryFallback.has(key) ? memoryFallback.get(key) : fallback;
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function writeJSON(kind, key, value) {
  memoryFallback.set(key, value); // keep the in-memory mirror current either way
  const storage = safeStorage(kind);
  if (!storage) return;
  try {
    storage.setItem(key, JSON.stringify(value));
  } catch {
    /* quota exceeded or storage revoked mid-session — in-memory mirror still holds */
  }
}

function removeKey(kind, key) {
  memoryFallback.delete(key);
  const storage = safeStorage(kind);
  if (!storage) return;
  try {
    storage.removeItem(key);
  } catch {
    /* ignore */
  }
}

export function getUsedIds(key) {
  return readJSON('session', `${NS}:used:${key}`, []);
}

export function markUsed(key, id) {
  const used = getUsedIds(key);
  used.push(id);
  writeJSON('session', `${NS}:used:${key}`, used);
}

// Picks a random entry from `list` (each item needs an `.id`) that hasn't
// been shown yet this session under `key`. Wraps around once exhausted.
export function pickRandomUnused(list, key, rng) {
  if (!list || list.length === 0) return null;
  const used = new Set(getUsedIds(key));
  let pool = list.filter((item) => !used.has(item.id));
  if (pool.length === 0) {
    removeKey('session', `${NS}:used:${key}`);
    pool = list;
  }
  const choice = pool[Math.floor(rng() * pool.length)];
  markUsed(key, choice.id);
  return choice;
}

export function loadStat(key, fallback) {
  return readJSON('local', `${NS}:stat:${key}`, fallback);
}

export function saveStat(key, value) {
  writeJSON('local', `${NS}:stat:${key}`, value);
}
