import { shuffle } from '../shared/js/rng.js';
import { SIZE, isValidPlacement, countSolutions } from './solver.js';

function fullSolution(rng) {
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  function findEmpty() {
    for (let r = 0; r < SIZE; r++) {
      for (let c = 0; c < SIZE; c++) {
        if (g[r][c] === 0) return [r, c];
      }
    }
    return null;
  }
  function backtrack() {
    const spot = findEmpty();
    if (!spot) return true;
    const [r, c] = spot;
    for (const v of shuffle([1, 2, 3, 4, 5, 6], rng)) {
      if (isValidPlacement(g, r, c, v)) {
        g[r][c] = v;
        if (backtrack()) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }
  backtrack();
  return g;
}

// Builds the solution first, then carves cells out one at a time, keeping
// each removal only if the puzzle still has exactly one solution.
export function generate(rng, targetGivens = 15) {
  const solution = fullSolution(rng);
  const puzzle = solution.map((row) => row.slice());
  const cells = shuffle(
    Array.from({ length: SIZE * SIZE }, (_, i) => [Math.floor(i / SIZE), i % SIZE]),
    rng
  );

  let givens = SIZE * SIZE;
  for (const [r, c] of cells) {
    if (givens <= targetGivens) break;
    const backup = puzzle[r][c];
    puzzle[r][c] = 0;
    if (countSolutions(puzzle, 2) === 1) {
      givens--;
    } else {
      puzzle[r][c] = backup;
    }
  }

  const given = puzzle.map((row) => row.map((v) => v !== 0));
  return { size: SIZE, solution, puzzle, given };
}
