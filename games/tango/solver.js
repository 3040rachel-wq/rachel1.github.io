// Generic 6x6 Tango solving/validation core. Doubles as the puzzle
// generator's uniqueness checker and the in-game Hint/auto-check engine.

export const SIZE = 6;
export const EMPTY = 0;
export const SUN = 1;
export const MOON = 2;

// Local legality check for placing `val` at (r,c) against whatever is
// already filled in `grid` — no-triple, balance (max 3 per row/col), and
// any marker constraint that already has its other side filled. Works for
// any fill order (row-major generation, or scattered givens during solving)
// since unfilled neighbors are EMPTY and never equal a real value.
export function isValidPlacement(grid, r, c, val, markers = []) {
  // no-triple: check every 3-window that would include (r,c) once filled
  if (c >= 2 && grid[r][c - 1] === val && grid[r][c - 2] === val) return false;
  if (c >= 1 && c <= SIZE - 2 && grid[r][c - 1] === val && grid[r][c + 1] === val) return false;
  if (c <= SIZE - 3 && grid[r][c + 1] === val && grid[r][c + 2] === val) return false;
  if (r >= 2 && grid[r - 1][c] === val && grid[r - 2][c] === val) return false;
  if (r >= 1 && r <= SIZE - 2 && grid[r - 1][c] === val && grid[r + 1][c] === val) return false;
  if (r <= SIZE - 3 && grid[r + 1][c] === val && grid[r + 2][c] === val) return false;

  // balance: no more than 3 of `val` in the row or column
  let rowCount = 0;
  let colCount = 0;
  for (let i = 0; i < SIZE; i++) {
    if (i !== c && grid[r][i] === val) rowCount++;
    if (i !== r && grid[i][c] === val) colCount++;
  }
  if (rowCount >= 3 || colCount >= 3) return false;

  // markers touching this cell whose other side is already filled
  for (const m of markers) {
    let ov = null;
    if (m.r1 === r && m.c1 === c) ov = grid[m.r2][m.c2];
    else if (m.r2 === r && m.c2 === c) ov = grid[m.r1][m.c1];
    if (ov === null || ov === EMPTY) continue;
    if (m.type === 'SAME' && ov !== val) return false;
    if (m.type === 'DIFF' && ov === val) return false;
  }

  return true;
}

export function rowLine(grid, r) {
  return grid[r];
}

export function colLine(grid, c) {
  return grid.map((row) => row[c]);
}

function linesEqual(a, b) {
  return a.every((v, i) => v === b[i]);
}

// True if row `r` is fully filled and identical to some other fully-filled row.
export function duplicatesRow(grid, r) {
  const line = rowLine(grid, r);
  if (line.some((v) => v === EMPTY)) return false;
  for (let i = 0; i < SIZE; i++) {
    if (i === r) continue;
    const other = rowLine(grid, i);
    if (other.some((v) => v === EMPTY)) continue;
    if (linesEqual(line, other)) return true;
  }
  return false;
}

// True if column `c` is fully filled and identical to some other fully-filled column.
export function duplicatesCol(grid, c) {
  const line = colLine(grid, c);
  if (line.some((v) => v === EMPTY)) return false;
  for (let i = 0; i < SIZE; i++) {
    if (i === c) continue;
    const other = colLine(grid, i);
    if (other.some((v) => v === EMPTY)) continue;
    if (linesEqual(line, other)) return true;
  }
  return false;
}

function findEmpty(grid) {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (grid[r][c] === EMPTY) return [r, c];
    }
  }
  return null;
}

// Full validation of a completely-filled grid: balance is implied by
// no-triple + per-value <=3 pruning holding all the way to a full board,
// so the only things left to check here are row/col uniqueness and markers.
export function isValidComplete(grid, markers = []) {
  for (let r = 0; r < SIZE; r++) {
    if (duplicatesRow(grid, r)) return false;
  }
  for (let c = 0; c < SIZE; c++) {
    if (duplicatesCol(grid, c)) return false;
  }
  for (const m of markers) {
    const v1 = grid[m.r1][m.c1];
    const v2 = grid[m.r2][m.c2];
    if (m.type === 'SAME' && v1 !== v2) return false;
    if (m.type === 'DIFF' && v1 === v2) return false;
  }
  return true;
}

// Counts solutions up to `cap` (stops early once reached) given some cells
// already filled in `grid` (0 = empty) plus marker constraints — used by the
// generator to confirm a carved puzzle still has exactly one solution.
export function countSolutions(grid, markers = [], cap = 2) {
  let count = 0;
  const g = grid.map((row) => row.slice());
  (function backtrack() {
    if (count >= cap) return;
    const spot = findEmpty(g);
    if (!spot) {
      if (isValidComplete(g, markers)) count++;
      return;
    }
    const [r, c] = spot;
    for (const v of [SUN, MOON]) {
      if (isValidPlacement(g, r, c, v, markers)) {
        g[r][c] = v;
        backtrack();
        g[r][c] = EMPTY;
        if (count >= cap) return;
      }
    }
  })();
  return count;
}

export function solveOne(grid, markers = []) {
  const g = grid.map((row) => row.slice());
  function backtrack() {
    const spot = findEmpty(g);
    if (!spot) return isValidComplete(g, markers);
    const [r, c] = spot;
    for (const v of [SUN, MOON]) {
      if (isValidPlacement(g, r, c, v, markers)) {
        g[r][c] = v;
        if (backtrack()) return true;
        g[r][c] = EMPTY;
      }
    }
    return false;
  }
  return backtrack() ? g : null;
}

// Returns { cells, markers } — a Set of "r,c" keys for cells that currently
// break balance, no-triple, or row/col uniqueness, and a Set of marker
// indexes whose constraint is currently violated. Drives the auto-check
// red-highlight feedback; safe to call on a partially-filled grid.
export function findConflicts(grid, markers = []) {
  const cells = new Set();

  // no-triple: any run of 3+ identical consecutive (filled) cells
  for (let r = 0; r < SIZE; r++) {
    let run = 1;
    for (let c = 1; c < SIZE; c++) {
      if (grid[r][c] !== EMPTY && grid[r][c] === grid[r][c - 1]) run++;
      else run = 1;
      if (run >= 3) {
        cells.add(`${r},${c}`);
        cells.add(`${r},${c - 1}`);
        cells.add(`${r},${c - 2}`);
      }
    }
  }
  for (let c = 0; c < SIZE; c++) {
    let run = 1;
    for (let r = 1; r < SIZE; r++) {
      if (grid[r][c] !== EMPTY && grid[r][c] === grid[r - 1][c]) run++;
      else run = 1;
      if (run >= 3) {
        cells.add(`${r},${c}`);
        cells.add(`${r - 1},${c}`);
        cells.add(`${r - 2},${c}`);
      }
    }
  }

  // balance: more than 3 of one value in a row/column (over-budget cells)
  for (let r = 0; r < SIZE; r++) {
    const line = rowLine(grid, r);
    const suns = line.filter((v) => v === SUN).length;
    const moons = line.filter((v) => v === MOON).length;
    const over = suns > 3 ? SUN : moons > 3 ? MOON : null;
    if (over) line.forEach((v, c) => { if (v === over) cells.add(`${r},${c}`); });
  }
  for (let c = 0; c < SIZE; c++) {
    const line = colLine(grid, c);
    const suns = line.filter((v) => v === SUN).length;
    const moons = line.filter((v) => v === MOON).length;
    const over = suns > 3 ? SUN : moons > 3 ? MOON : null;
    if (over) line.forEach((v, r) => { if (v === over) cells.add(`${r},${c}`); });
  }

  // uniqueness: fully-filled rows/columns that duplicate another
  for (let r = 0; r < SIZE; r++) {
    if (duplicatesRow(grid, r)) rowLine(grid, r).forEach((_, c) => cells.add(`${r},${c}`));
  }
  for (let c = 0; c < SIZE; c++) {
    if (duplicatesCol(grid, c)) colLine(grid, c).forEach((_, r) => cells.add(`${r},${c}`));
  }

  // markers: both sides filled but the constraint doesn't hold
  const badMarkers = new Set();
  markers.forEach((m, i) => {
    const v1 = grid[m.r1][m.c1];
    const v2 = grid[m.r2][m.c2];
    if (v1 === EMPTY || v2 === EMPTY) return;
    if ((m.type === 'SAME' && v1 !== v2) || (m.type === 'DIFF' && v1 === v2)) {
      badMarkers.add(i);
      cells.add(`${m.r1},${m.c1}`);
      cells.add(`${m.r2},${m.c2}`);
    }
  });

  return { cells, markers: badMarkers };
}
