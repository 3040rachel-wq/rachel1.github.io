// Patches (Shikaku-style) puzzle generator.
//
// Builds the solution first via recursive guillotine partitioning of the
// full grid into leaf rectangles (roughly 2-12 cells each), then drops one
// clue into each leaf. The resulting leaf tiling IS a valid solution by
// construction — validator.js's validateSolution is run as a self-check
// before returning (regenerate on the vanishingly unlikely chance it fails,
// which would indicate a generator bug).

import { randInt } from '../shared/js/rng.js';
import { validateSolution } from './validator.js';

const MIN_LEAF_AREA = 2;
const MAX_LEAF_AREA = 12;
const RANDOM_SPLIT_PROBABILITY = 0.35; // adds size variance below MAX_LEAF_AREA
const SHAPE_BADGE_PROBABILITY = 0.3;
const MAX_GENERATION_ATTEMPTS = 30;

// Picks how big the "first" side of a cut is, out of a run of length n.
// Keeps both resulting sides >= 2 whenever n allows it, and never lets a
// cut land flush against either edge when there's room to spare.
function pickCutSize(n, rng) {
  if (n >= 4) return randInt(rng, 2, n - 2);
  return randInt(rng, 1, n - 1); // n is 2 or 3 — only thin splits possible
}

// Cuts along the longer dimension (keeps pieces from getting too sliver-y);
// picks randomly when square. Returns null if the region can't be split at
// all (both dimensions are 1).
function chooseOrientation(w, h, rng) {
  if (w >= 2 && h >= 2) {
    if (w > h) return 'v';
    if (h > w) return 'h';
    return rng() < 0.5 ? 'v' : 'h';
  }
  if (w >= 2) return 'v';
  if (h >= 2) return 'h';
  return null;
}

function shouldSplit(area, rng) {
  if (area <= MIN_LEAF_AREA) return false;
  if (area > MAX_LEAF_AREA) return true;
  if (area >= 4) return rng() < RANDOM_SPLIT_PROBABILITY;
  return false;
}

function partition(region, rng, leaves) {
  const { r0, c0, r1, c1 } = region;
  const w = c1 - c0 + 1;
  const h = r1 - r0 + 1;
  const area = w * h;

  if (!shouldSplit(area, rng)) {
    leaves.push(region);
    return;
  }

  const orientation = chooseOrientation(w, h, rng);
  if (!orientation) {
    leaves.push(region);
    return;
  }

  if (orientation === 'v') {
    const leftW = pickCutSize(w, rng);
    partition({ r0, c0, r1, c1: c0 + leftW - 1 }, rng, leaves);
    partition({ r0, c0: c0 + leftW, r1, c1 }, rng, leaves);
  } else {
    const topH = pickCutSize(h, rng);
    partition({ r0, c0, r1: r0 + topH - 1, c1 }, rng, leaves);
    partition({ r0: r0 + topH, c0, r1, c1 }, rng, leaves);
  }
}

function placeClues(leaves, rng) {
  return leaves.map((rect) => {
    const r = randInt(rng, rect.r0, rect.r1);
    const c = randInt(rng, rect.c0, rect.c1);
    const width = rect.c1 - rect.c0 + 1;
    const height = rect.r1 - rect.r0 + 1;
    const actualShape = width > height ? 'wide' : height > width ? 'tall' : 'square';
    const shape = rng() < SHAPE_BADGE_PROBABILITY ? actualShape : 'any';
    return { r, c, count: width * height, shape };
  });
}

function buildOnce(rng, rows, cols) {
  const leaves = [];
  partition({ r0: 0, c0: 0, r1: rows - 1, c1: cols - 1 }, rng, leaves);
  const clues = placeClues(leaves, rng);
  return { rows, cols, clues, solutionRects: leaves };
}

// generate(rng, rows=8, cols=8) -> { rows, cols, clues, solutionRects }
export function generate(rng, rows = 8, cols = 8) {
  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt++) {
    const puzzle = buildOnce(rng, rows, cols);
    const check = validateSolution(puzzle.solutionRects, puzzle.clues, rows, cols);
    if (check.valid) return puzzle;
  }
  throw new Error('Patches generator: failed to build a valid puzzle after multiple attempts');
}
