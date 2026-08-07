// Generic rectangular-grid helpers reused by every board-based game.

export function makeGrid(rows, cols, fill) {
  return Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => (typeof fill === 'function' ? fill(r, c) : fill))
  );
}

export function cloneGrid(g) {
  return g.map((row) => row.slice());
}

export const ORTHO = [
  [-1, 0],
  [1, 0],
  [0, -1],
  [0, 1],
];

export const ALL8 = [
  [-1, -1], [-1, 0], [-1, 1],
  [0, -1], [0, 1],
  [1, -1], [1, 0], [1, 1],
];

export function inBounds(r, c, rows, cols) {
  return r >= 0 && r < rows && c >= 0 && c < cols;
}

export function neighbors4(r, c, rows, cols) {
  return ORTHO.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => inBounds(nr, nc, rows, cols));
}

export function neighbors8(r, c, rows, cols) {
  return ALL8.map(([dr, dc]) => [r + dr, c + dc]).filter(([nr, nc]) => inBounds(nr, nc, rows, cols));
}

export function key(r, c) {
  return `${r},${c}`;
}
