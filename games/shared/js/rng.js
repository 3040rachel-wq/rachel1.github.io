// Small seedable PRNG + helpers shared by every game's generator.
// Deterministic when given a seed (useful for testing), random by default.

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0;
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomSeed() {
  return (Math.random() * 4294967296) >>> 0;
}

export function makeRng(seed) {
  return mulberry32(seed === undefined ? randomSeed() : seed);
}

export function shuffle(arr, rng) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Inclusive random integer in [min, max]
export function randInt(rng, min, max) {
  return min + Math.floor(rng() * (max - min + 1));
}

export function pick(arr, rng) {
  return arr[Math.floor(rng() * arr.length)];
}
