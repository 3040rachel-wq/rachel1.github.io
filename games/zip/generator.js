import { shuffle, randInt } from '../shared/js/rng.js';
import { SIZE, solve, edgeKey } from './solver.js';

// ---- Hamiltonian path construction --------------------------------------
//
// Randomized DFS with a connectivity prune: at each step, among the
// current cell's shuffled unvisited orthogonal neighbors, before
// committing to a candidate we flood-fill the cells that would remain
// unvisited (as if the candidate had been taken) and confirm they're
// still all mutually reachable from one another via unvisited orthogonal
// adjacency. A candidate that would strand part of the grid is skipped in
// favor of another; if every candidate fails we backtrack. This keeps the
// DFS from wandering into a dead corner and reliably finds full
// Hamiltonian paths on grid graphs at least up to 8x8 quickly.
//
// This mirrors solver.js's optimized solve(): flat integer cell ids,
// typed arrays, and scratch buffers reused across every connectivity
// check rather than rebuilding a string-keyed Set from scratch per
// candidate. An earlier version of this file did exactly that (string
// keys everywhere) and was ~50x too slow to be practical — the same
// defect solver.js's optimization comment warns about, just left
// unfixed here. Measured: a single generate() call could take 20-30+
// seconds on some seeds before this fix (see stress-test results),
// which on a real "New Game" click would look like the page hanging.

function buildHamiltonianPath(rng, size, stepBudget = 400000) {
  const total = size * size;
  const id = (r, c) => r * size + c;

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

  // Scratch buffers reused across every connectivity-flood call, exactly
  // like solver.js's remainingConnected() — never allocates per-candidate.
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
        floodSeenAt[nb] = floodVersion;
        floodStack[sp++] = nb;
        seenCount++;
      }
    }
    return seenCount === remainingCount;
  }

  function shuffledNeighbors(cellId) {
    const list = adj[cellId].slice();
    for (let i = list.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [list[i], list[j]] = [list[j], list[i]];
    }
    return list;
  }

  let steps = 0;
  function backtrack() {
    steps++;
    if (steps > stepBudget) return false;
    if (pathLen === total) return true;

    const cur = pathIds[pathLen - 1];
    for (const nb of shuffledNeighbors(cur)) {
      if (visited[nb]) continue;

      visited[nb] = 1;
      pathIds[pathLen++] = nb;

      const stillConnected = pathLen === total || remainingConnected(total - pathLen);
      if (stillConnected && backtrack()) return true;

      pathLen--;
      visited[nb] = 0;
      if (steps > stepBudget) return false;
    }
    return false;
  }

  const startR = randInt(rng, 0, size - 1);
  const startC = randInt(rng, 0, size - 1);
  visited[id(startR, startC)] = 1;
  pathIds[pathLen++] = id(startR, startC);

  if (!backtrack()) return null;
  const out = new Array(total);
  for (let i = 0; i < total; i++) {
    out[i] = { r: Math.floor(pathIds[i] / size), c: pathIds[i] % size };
  }
  return out;
}

// ---- Checkpoints ----------------------------------------------------------
// Samples ~5-7 indices into the solution path (always including the first
// and last cell) and numbers them in ascending order.
function sampleCheckpoints(rng, path) {
  const total = path.length;
  const target = randInt(rng, 5, Math.min(7, total));
  const indices = new Set([0, total - 1]);
  let guard = 0;
  while (indices.size < target && guard < 200) {
    indices.add(randInt(rng, 1, total - 2));
    guard++;
  }
  return [...indices]
    .sort((a, b) => a - b)
    .map((idx, i) => ({ number: i + 1, r: path[idx].r, c: path[idx].c }));
}

// ---- Walls ------------------------------------------------------------
// Picks random orthogonally-adjacent cell pairs that are NOT consecutive
// in the solution path, so a wall can never block the intended solution.
function sampleWalls(rng, path, size, count) {
  const consecutive = new Set();
  for (let i = 0; i < path.length - 1; i++) {
    consecutive.add(edgeKey(path[i].r, path[i].c, path[i + 1].r, path[i + 1].c));
  }
  const allEdges = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (c + 1 < size) allEdges.push({ r1: r, c1: c, r2: r, c2: c + 1 });
      if (r + 1 < size) allEdges.push({ r1: r, c1: c, r2: r + 1, c2: c });
    }
  }
  const candidates = shuffle(allEdges, rng).filter(
    (e) => !consecutive.has(edgeKey(e.r1, e.c1, e.r2, e.c2))
  );
  return candidates.slice(0, count);
}

// generate(rng, size=7) -> { size, path, checkpoints, walls }
//   path:        solution order, array of {r,c}, length size*size
//   checkpoints: [{number, r, c}], ascending, #1 = path start, last = path end
//   walls:       [{r1,c1,r2,c2}], edges the path may never cross
export function generate(rng, size = SIZE) {
  for (let attempt = 0; attempt < 20; attempt++) {
    const path = buildHamiltonianPath(rng, size);
    if (!path) continue;

    const checkpoints = sampleCheckpoints(rng, path);
    const walls = sampleWalls(rng, path, size, randInt(rng, 3, 5));

    // Correctness smoke test: the solver should always confirm this is
    // solvable, since the solution path we just built satisfies the
    // checkpoint order by construction and walls were only placed on
    // non-solution edges. If this ever fails it signals a generator bug
    // rather than a genuinely unsolvable puzzle, so we simply retry.
    const check = solve(size, checkpoints, walls, { nodeBudget: 200000, wantSecond: false });
    if (!check.solution) continue;

    // Opportunistic uniqueness probe (small budget, best-effort): looks
    // for a second distinct solution. Per project scope this is never
    // required to succeed — exceeding the budget without finding one is
    // treated as "probably fine" rather than a failure, so we accept the
    // puzzle either way and just record what we learned.
    const probe = solve(size, checkpoints, walls, { nodeBudget: 20000, wantSecond: true });

    return { size, path, checkpoints, walls, hadAlternateSolution: probe.secondFound };
  }
  throw new Error('Zip generator: failed to build a solvable puzzle after 20 attempts');
}
