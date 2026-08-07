// Generic 8x8 Queens solving/validation core. Doubles as the puzzle
// generator's uniqueness checker and the in-game auto-check/Hint engine.
// A "crown" is a placed queen; `regionGrid[r][c]` holds that cell's
// region id (0..SIZE-1).

export const SIZE = 8;

// Checks whether placing a crown at (r, c) is compatible with `placed`
// (an array of {r, c} crown positions already on the board) — no shared
// row/column/region, and no 8-directional adjacency.
export function canPlace(regionGrid, placed, r, c) {
  const region = regionGrid[r][c];
  for (const p of placed) {
    if (p.r === r || p.c === c) return false;
    if (regionGrid[p.r][p.c] === region) return false;
    if (Math.abs(p.r - r) <= 1 && Math.abs(p.c - c) <= 1) return false;
  }
  return true;
}

// Counts solutions to a region grid, up to `cap` (stops early once
// reached) — used to confirm a generated puzzle has a unique solution.
// Places one crown per row, trying every column; canPlace enforces
// column/region/adjacency uniqueness (row uniqueness is implicit).
export function countSolutions(regionGrid, cap = 2) {
  const size = regionGrid.length;
  let count = 0;
  const placed = [];
  (function backtrack(r) {
    if (count >= cap) return;
    if (r === size) {
      count++;
      return;
    }
    for (let c = 0; c < size; c++) {
      if (canPlace(regionGrid, placed, r, c)) {
        placed.push({ r, c });
        backtrack(r + 1);
        placed.pop();
        if (count >= cap) return;
      }
    }
  })(0);
  return count;
}

// Solves a region grid, returning one full solution as an array of
// {r, c} crown positions (or null if none exists).
export function solveOne(regionGrid) {
  const size = regionGrid.length;
  const placed = [];
  function backtrack(r) {
    if (r === size) return true;
    for (let c = 0; c < size; c++) {
      if (canPlace(regionGrid, placed, r, c)) {
        placed.push({ r, c });
        if (backtrack(r + 1)) return true;
        placed.pop();
      }
    }
    return false;
  }
  return backtrack(0) ? placed.slice() : null;
}

// Returns a set of "r,c" keys for CROWN cells that currently violate the
// row/column/region/adjacency rules — used to drive the auto-check
// red-highlight feedback. `placedCrowns` is the list of {r, c} crown
// positions currently on the board (X marks don't participate).
export function findConflicts(regionGrid, placedCrowns) {
  const bad = new Set();
  for (let i = 0; i < placedCrowns.length; i++) {
    const a = placedCrowns[i];
    for (let j = 0; j < placedCrowns.length; j++) {
      if (i === j) continue;
      const b = placedCrowns[j];
      const sameRegion = regionGrid[a.r][a.c] === regionGrid[b.r][b.c];
      const touching = Math.abs(a.r - b.r) <= 1 && Math.abs(a.c - b.c) <= 1;
      if (a.r === b.r || a.c === b.c || sameRegion || touching) {
        bad.add(`${a.r},${a.c}`);
      }
    }
  }
  return bad;
}

// Finds the first solution crown that isn't yet correctly placed on the
// board — used by the Hint button.
export function nextHintCell(regionGrid, placedCrowns, solution) {
  const have = new Set(placedCrowns.map((p) => `${p.r},${p.c}`));
  for (const s of solution) {
    if (!have.has(`${s.r},${s.c}`)) return s;
  }
  return null;
}
