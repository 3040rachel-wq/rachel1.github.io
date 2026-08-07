// Generic Hamiltonian-path-with-checkpoints-and-walls engine for Zip.
//
// Used for two things:
//  (a) a generation-time smoke test that confirms a freshly built puzzle
//      really is solvable given its checkpoints/walls (a correctness guard
//      against generator bugs — walls are only ever placed on non-solution
//      edges, so this should always succeed by construction);
//  (b) the basis for the in-game Hint feature, via computeHint() below.
//
// Full uniqueness (exactly one solution) is NOT required for this puzzle
// type per project scope. solve() can opportunistically look for a second
// distinct solution within its node budget (wantSecond: true) — finding one
// just means the puzzle is a little less "unique-feeling"; per project
// scope we still accept the puzzle rather than regenerating forever, and
// exceeding the node budget without finding a second solution is treated
// as "probably fine", not as a failure. This keeps generation fast at N=7
// without needing a combinatorial uniqueness proof.

import { neighbors4, key } from '../shared/js/grid.js';

export const SIZE = 7;

export function edgeKey(r1, c1, r2, c2) {
  const a = `${r1},${c1}`;
  const b = `${r2},${c2}`;
  return a < b ? `${a}|${b}` : `${b}|${a}`;
}

export function makeWallSet(walls) {
  const s = new Set();
  for (const w of walls) s.add(edgeKey(w.r1, w.c1, w.r2, w.c2));
  return s;
}

export function isWalled(wallSet, r1, c1, r2, c2) {
  return wallSet.has(edgeKey(r1, c1, r2, c2));
}

function checkpointMap(checkpoints) {
  const m = new Map();
  for (const cp of checkpoints) m.set(key(cp.r, cp.c), cp.number);
  return m;
}

// Attempts to find a Hamiltonian path over the `size`x`size` grid that:
//  - starts at checkpoint #1
//  - visits every cell exactly once
//  - never crosses a walled edge
//  - visits every checkpoint in strictly ascending numeric order
//
// Checkpoint order is enforced eagerly during the search: a candidate cell
// that carries checkpoint number X is only legal to step onto once every
// checkpoint below X has already been visited (X === nextRequiredNumber).
// This is both correct (a Hamiltonian path visits every cell including
// every checkpoint, so no checkpoint can be permanently skipped) and a
// strong prune that keeps the search fast.
//
// Returns { solution: Cell[]|null, nodesUsed, secondFound }
export function solve(size, checkpoints, walls, opts = {}) {
  const { nodeBudget = 200000, wantSecond = false } = opts;
  const wallSet = walls instanceof Set ? walls : makeWallSet(walls);
  const cpMap = checkpointMap(checkpoints);
  const total = size * size;
  const maxNumber = checkpoints.reduce((m, cp) => Math.max(m, cp.number), 0);
  const first = checkpoints.find((cp) => cp.number === 1);

  if (!first) return { solution: null, nodesUsed: 0, secondFound: false };

  let nodes = 0;
  let firstSolution = null;
  let secondFound = false;

  const visited = new Set();
  const path = [];

  function pushCell(r, c) {
    visited.add(key(r, c));
    path.push({ r, c });
  }
  function popCell() {
    const cell = path.pop();
    visited.delete(key(cell.r, cell.c));
  }

  function backtrack(nextRequired) {
    if (nodes >= nodeBudget) return false;
    nodes++;

    if (path.length === total) {
      if (nextRequired > maxNumber) {
        if (!firstSolution) {
          firstSolution = path.map((c) => ({ r: c.r, c: c.c }));
          if (!wantSecond) return true;
        } else {
          secondFound = true;
          return true; // stop early once a 2nd distinct solution is confirmed
        }
      }
      return false;
    }

    const cur = path[path.length - 1];
    for (const [nr, nc] of neighbors4(cur.r, cur.c, size, size)) {
      if (visited.has(key(nr, nc))) continue;
      if (isWalled(wallSet, cur.r, cur.c, nr, nc)) continue;
      const cpNum = cpMap.get(key(nr, nc));
      if (cpNum !== undefined && cpNum !== nextRequired) continue; // out-of-order checkpoint
      const newRequired = cpNum !== undefined ? nextRequired + 1 : nextRequired;
      pushCell(nr, nc);
      if (backtrack(newRequired)) return true;
      popCell();
      if (nodes >= nodeBudget) return false;
    }
    return false;
  }

  pushCell(first.r, first.c);
  backtrack(2);
  return { solution: firstSolution, nodesUsed: nodes, secondFound };
}

// Does the completed `path` (array of {r,c}, length size*size) visit every
// checkpoint in strictly ascending numeric order? Combined with "path
// covers every cell", this is the full win condition.
export function isWinningPath(path, size, checkpoints) {
  if (path.length !== size * size) return false;
  const posOf = new Map();
  path.forEach((cell, i) => posOf.set(key(cell.r, cell.c), i));
  let lastIndex = -1;
  for (const cp of [...checkpoints].sort((a, b) => a.number - b.number)) {
    const idx = posOf.get(key(cp.r, cp.c));
    if (idx === undefined || idx <= lastIndex) return false;
    lastIndex = idx;
  }
  return true;
}

// Hint logic: compare the player's current path against the generator's
// stored solution path cell-by-cell from the start. Truncate the player's
// path back to the last point where it still matches the solution, then
// reveal the next correct cell. Mirrors the real game's documented
// "hint erases back to your first mistake and reveals the next correct
// step" behavior.
export function computeHint(playerPath, solutionPath) {
  let matchLen = 0;
  while (
    matchLen < playerPath.length &&
    matchLen < solutionPath.length &&
    playerPath[matchLen].r === solutionPath[matchLen].r &&
    playerPath[matchLen].c === solutionPath[matchLen].c
  ) {
    matchLen++;
  }
  const corrected = matchLen < playerPath.length;
  const truncated = solutionPath.slice(0, matchLen);
  const revealed = matchLen < solutionPath.length ? solutionPath[matchLen] : null;
  const path = revealed ? [...truncated, revealed] : truncated;
  return { path, corrected, revealed };
}
