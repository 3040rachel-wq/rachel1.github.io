// sessionStorage-backed "don't repeat a puzzle until you've seen them all"
// helper for the content-driven games (Crossclimb, Pinpoint, Wend), plus a
// tiny localStorage wrapper for simple persistent stats (streaks, etc.).

const NS = 'li-games';

function readJSON(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw === null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function getUsedIds(key) {
  return readJSON(sessionStorage, `${NS}:used:${key}`, []);
}

export function markUsed(key, id) {
  const used = getUsedIds(key);
  used.push(id);
  sessionStorage.setItem(`${NS}:used:${key}`, JSON.stringify(used));
}

// Picks a random entry from `list` (each item needs an `.id`) that hasn't
// been shown yet this session under `key`. Wraps around once exhausted.
export function pickRandomUnused(list, key, rng) {
  if (!list || list.length === 0) return null;
  const used = new Set(getUsedIds(key));
  let pool = list.filter((item) => !used.has(item.id));
  if (pool.length === 0) {
    sessionStorage.removeItem(`${NS}:used:${key}`);
    pool = list;
  }
  const choice = pool[Math.floor(rng() * pool.length)];
  markUsed(key, choice.id);
  return choice;
}

export function loadStat(key, fallback) {
  return readJSON(localStorage, `${NS}:stat:${key}`, fallback);
}

export function saveStat(key, value) {
  try {
    localStorage.setItem(`${NS}:stat:${key}`, JSON.stringify(value));
  } catch {
    /* storage unavailable (private mode, quota) — fail silently */
  }
}
