import { shuffle, randInt } from '../shared/js/rng.js';
import { neighbors4, key } from '../shared/js/grid.js';
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

function floodConnected(unvisited, size) {
  if (unvisited.size <= 1) return true;
  const start = unvisited.values().next().value;
  const seen = new Set([start]);
  const stack = [start];
  while (stack.length) {
    const k = stack.pop();
    const [r, c] = k.split(',').map(Number);
    for (const [nr, nc] of neighbors4(r, c, size, size)) {
      const nk = key(nr, nc);
      if (unvisited.has(nk) && !seen.has(nk)) {
        seen.add(nk);
        stack.push(nk);
      }
    }
  }
  return seen.size === unvisited.size;
}

function allUnvisited(visited, size) {
  const s = new Set();
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const k = key(r, c);
      if (!visited.has(k)) s.add(k);
    }
  }
  return s;
}

function buildHamiltonianPath(rng, size, stepBudget = 400000) {
  const total = size * size;
  const startR = randInt(rng, 0, size - 1);
  const startC = randInt(rng, 0, size - 1);

  const visited = new Set([key(startR, startC)]);
  const path = [{ r: startR, c: startC }];
  let steps = 0;

  function backtrack() {
    steps++;
    if (steps > stepBudget) return false;
    if (path.length === total) return true;

    const cur = path[path.length - 1];
    for (const [nr, nc] of shuffle(neighbors4(cur.r, cur.c, size, size), rng)) {
      const nk = key(nr, nc);
      if (visited.has(nk)) continue;

      // Would taking this candidate strand the rest of the grid?
      visited.add(nk);
      const remaining = allUnvisited(visited, size);
      const ok = floodConnected(remaining, size);
      if (!ok) {
        visited.delete(nk);
        continue;
      }

      path.push({ r: nr, c: nc });
      if (backtrack()) return true;
      path.pop();
      visited.delete(nk);
      if (steps > stepBudget) return false;
    }
    return false;
  }

  return backtrack() ? path.map((c) => ({ r: c.r, c: c.c })) : null;
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
