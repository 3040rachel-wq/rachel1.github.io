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

import { key } from '../shared/js/grid.js';

export const SIZE = 7;

// ---- Public edge/wall helpers -------------------------------------------
// String-keyed and simple — used by main.js for interactive move-legality
// checks, which only run once per pointer-drag step (low frequency), so
// the extra string-hashing cost here is a non-issue.

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

// ---- Backtracking search --------------------------------------------------
// Everything below operates on flat integer cell ids (id = r*size + c) and
// typed arrays rather than string-keyed Sets/Maps — this is the hot path
// (up to `nodeBudget` backtrack steps, each re-testing connectivity over
// the remaining unvisited region), and on a 49-cell board the string-key
// version above was ~50x too slow to be practical. The public shape in and
// out of solve() is still plain {r,c} objects.

function shuffleInPlace(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
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
// A connectivity prune — same idea the generator uses to build its
// Hamiltonian path — rejects any candidate move that would strand the
// remaining unvisited region into disconnected pieces, before recursing
// into it. Without this, plain backtracking essentially never completes a
// 49-cell Hamiltonian search within a sane node budget.
//
// Returns { solution: Cell[]|null, nodesUsed, secondFound }
export function solve(size, checkpoints, walls, opts = {}) {
  const { nodeBudget = 200000, wantSecond = false } = opts;
  const total = size * size;
  const id = (r, c) => r * size + c;

  const first = checkpoints.find((cp) => cp.number === 1);
  if (!first) return { solution: null, nodesUsed: 0, secondFound: false };
  const maxNumber = checkpoints.reduce((m, cp) => Math.max(m, cp.number), 0);

  const cpNumberAt = new Int16Array(total); // 0 = no checkpoint here
  for (const cp of checkpoints) cpNumberAt[id(cp.r, cp.c)] = cp.number;

  const wallEdgeIds = new Set();
  for (const w of walls) {
    const a = id(w.r1, w.c1);
    const b = id(w.r2, w.c2);
    wallEdgeIds.add(a < b ? a * total + b : b * total + a);
  }
  const isBlocked = (a, b) => wallEdgeIds.has(a < b ? a * total + b : b * total + a);

  // Static orthogonal adjacency list, built once per call.
  const adj = new Array(total);
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const list = [];
      if (r > 0) list.push(id(r - 1, c));
      if (r < size - 1) list.push(id(r + 1, c));
      if (c > 0) list.push(id(r, c - 1));
      if (c < size - 1) list.push(id(r, c + 1));
      adj[id(r, c)] = list;
    }
  }

  const visited = new Uint8Array(total);
  const pathIds = new Int32Array(total);
  let pathLen = 0;

  let nodes = 0;
  let firstSolution = null;
  let secondFound = false;

  // Scratch buffers reused across every connectivity-flood call so it
  // never allocates — `floodSeenAt` is compared against a per-call
  // version counter instead of being cleared each time.
  const floodSeenAt = new Int32Array(total).fill(-1);
  const floodStack = new Int32Array(total);
  let floodVersion = 0;

  function remainingConnected(remainingCount) {
    if (remainingCount <= 1) return true;
    let startId = -1;
    for (let i = 0; i < total; i++) {
      if (!visited[i]) {
        startId = i;
        break;
      }
    }
    floodVersion++;
    let sp = 0;
    floodStack[sp++] = startId;
    floodSeenAt[startId] = floodVersion;
    let seenCount = 1;
    while (sp > 0) {
      const cur = floodStack[--sp];
      for (const nb of adj[cur]) {
        if (visited[nb]) continue;
        if (floodSeenAt[nb] === floodVersion) continue;
        if (isBlocked(cur, nb)) continue;
        floodSeenAt[nb] = floodVersion;
        floodStack[sp++] = nb;
        seenCount++;
      }
    }
    return seenCount === remainingCount;
  }

  function toCells(ids) {
    const out = new Array(ids.length);
    for (let i = 0; i < ids.length; i++) {
      const cid = ids[i];
      out[i] = { r: Math.floor(cid / size), c: cid % size };
    }
    return out;
  }

  function backtrack(nextRequired) {
    if (nodes >= nodeBudget) return false;
    nodes++;

    if (pathLen === total) {
      if (nextRequired > maxNumber) {
        if (!firstSolution) {
          firstSolution = toCells(pathIds);
          if (!wantSecond) return true;
        } else {
          secondFound = true;
          return true; // stop early once a 2nd distinct solution is confirmed
        }
      }
      return false;
    }

    const cur = pathIds[pathLen - 1];
    // A fixed neighbor-visit order makes worst-case backtracking far more
    // likely to stumble down a long dead branch before finding any
    // solution; shuffling breaks that up the same way the generator's own
    // randomized DFS does. Solve() doesn't need to be reproducible.
    for (const nb of shuffleInPlace(adj[cur].slice())) {
      if (visited[nb]) continue;
      if (isBlocked(cur, nb)) continue;
      const cpNum = cpNumberAt[nb];
      if (cpNum !== 0 && cpNum !== nextRequired) continue; // out-of-order checkpoint
      const newRequired = cpNum !== 0 ? nextRequired + 1 : nextRequired;

      visited[nb] = 1;
      pathIds[pathLen++] = nb;

      const stillConnected = pathLen === total || remainingConnected(total - pathLen);
      if (stillConnected && backtrack(newRequired)) return true;

      pathLen--;
      visited[nb] = 0;
      if (nodes >= nodeBudget) return false;
    }
    return false;
  }

  const startId = id(first.r, first.c);
  visited[startId] = 1;
  pathIds[pathLen++] = startId;
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
