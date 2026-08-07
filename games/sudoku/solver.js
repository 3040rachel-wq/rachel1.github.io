// Generic 6x6 mini-sudoku solving/validation core. Doubles as the puzzle
// generator's uniqueness checker and the in-game Hint engine.

export const SIZE = 6;
export const BOX_R = 2;
export const BOX_C = 3;

export function isValidPlacement(grid, r, c, val) {
  for (let i = 0; i < SIZE; i++) {
    if (i !== c && grid[r][i] === val) return false;
    if (i !== r && grid[i][c] === val) return false;
  }
  const br = Math.floor(r / BOX_R) * BOX_R;
  const bc = Math.floor(c / BOX_C) * BOX_C;
  for (let dr = 0; dr < BOX_R; dr++) {
    for (let dc = 0; dc < BOX_C; dc++) {
      const rr = br + dr;
      const cc = bc + dc;
      if ((rr !== r || cc !== c) && grid[rr][cc] === val) return false;
    }
  }
  return true;
}

function findEmpty(g) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (g[r][c] === 0) return [r, c];
    }
  }
  return null;
}

// Counts solutions up to `cap` (stops early once reached) — used to confirm
// a carved puzzle still has exactly one solution.
export function countSolutions(grid, cap = 2) {
  let count = 0;
  const g = grid.map((row) => row.slice());
  (function backtrack() {
    if (count >= cap) return;
    const spot = findEmpty(g);
    if (!spot) {
      count++;
      return;
    }
    const [r, c] = spot;
    for (let v = 1; v <= SIZE; v++) {
      if (isValidPlacement(g, r, c, v)) {
        g[r][c] = v;
        backtrack();
        g[r][c] = 0;
        if (count >= cap) return;
      }
    }
  })();
  return count;
}

export function solveOne(grid) {
  const g = grid.map((row) => row.slice());
  function backtrack() {
    const spot = findEmpty(g);
    if (!spot) return true;
    const [r, c] = spot;
    for (let v = 1; v <= SIZE; v++) {
      if (isValidPlacement(g, r, c, v)) {
        g[r][c] = v;
        if (backtrack()) return true;
        g[r][c] = 0;
      }
    }
    return false;
  }
  return backtrack() ? g : null;
}

// Returns a set of "r,c" keys for cells that currently break row/col/box
// uniqueness — used to drive the auto-check red-highlight feedback.
export function findConflicts(grid) {
  const bad = new Set();
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const v = grid[r][c];
      if (!v) continue;
      const copy = grid.map((row) => row.slice());
      copy[r][c] = 0;
      if (!isValidPlacement(copy, r, c, v)) bad.add(`${r},${c}`);
    }
  }
  return bad;
}
