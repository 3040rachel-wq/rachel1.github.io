import { shuffle, randInt } from '../shared/js/rng.js';
import {
  SIZE,
  EMPTY,
  SUN,
  MOON,
  isValidPlacement,
  duplicatesRow,
  duplicatesCol,
  countSolutions,
} from './solver.js';

function emptyGrid() {
  return Array.from({ length: SIZE }, () => Array(SIZE).fill(EMPTY));
}

// Step 1 — build one full valid solution via randomized row-major
// backtracking. isValidPlacement already enforces no-triple + the <=3
// balance cap on every placement, so once a row/column is completely filled
// it is automatically exactly 3/3 — the only extra thing to check at that
// point is that it doesn't duplicate an earlier completed row/column.
function buildSolution(rng) {
  const g = emptyGrid();

  function findEmpty() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === EMPTY) return [r, c];
      }
    }
    return null;
  }

  function backtrack() {
    const spot = findEmpty();
    if (!spot) return true;
    const [r, c] = spot;
    for (const v of shuffle([SUN, MOON], rng)) {
      if (!isValidPlacement(g, r, c, v, [])) continue;
      g[r][c] = v;
      const rowOk = c !== SIZE - 1 || !duplicatesRow(g, r);
      const colOk = r !== SIZE - 1 || !duplicatesCol(g, c);
      if (rowOk && colOk && backtrack()) return true;
      g[r][c] = EMPTY;
    }
    return false;
  }

  backtrack();
  return g;
}

// Step 2 — pick a handful of random adjacent (orthogonal) cell pairs and
// derive their marker type by reading the solution.
function deriveMarkers(solution, rng, count) {
  const candidates = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (c < SIZE - 1) candidates.push([r, c, r, c + 1]);
      if (r < SIZE - 1) candidates.push([r, c, r + 1, c]);
    }
  }
  const chosen = shuffle(candidates, rng).slice(0, count);
  return chosen.map(([r1, c1, r2, c2]) => ({
    r1,
    c1,
    r2,
    c2,
    type: solution[r1][c1] === solution[r2][c2] ? 'SAME' : 'DIFF',
  }));
}

// Step 3 — carve givens one at a time (random order), keeping the puzzle
// confirmed unique (markers + givens) after each addition via the general
// backtracking solver, capped at 2 solutions.
function carveGivens(solution, markers, rng) {
  const givenMask = Array.from({ length: SIZE }, () => Array(SIZE).fill(false));

  const order = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE]),
    rng
  );

  function puzzleGrid() {
    const g = emptyGrid();
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (givenMask[r][c]) g[r][c] = solution[r][c];
      }
    }
    return g;
  }

  // Markers alone might already pin the grid down uniquely.
  if (countSolutions(puzzleGrid(), markers, 2) === 1) return givenMask;

  for (const [r, c] of order) {
    givenMask[r][c] = true;
    if (countSolutions(puzzleGrid(), markers, 2) === 1) break;
  }

  return givenMask;
}

// generate(rng) -> { grid: 6x6 solution, givenMask: 6x6 bool grid, markers }
export function generate(rng) {
  const solution = buildSolution(rng);
  const markerCount = randInt(rng, 6, 10);
  const markers = deriveMarkers(solution, rng, markerCount);
  const givenMask = carveGivens(solution, markers, rng);
  return { grid: solution, givenMask, markers };
}
