import { el, clear, svg } from '../shared/js/dom.js';

function checkpointMap(checkpoints) {
  const m = new Map();
  for (const cp of checkpoints) m.set(`${cp.r},${cp.c}`, cp.number);
  return m;
}

// Returns "r,c" -> { left, right, top, bottom } wall-side flags so each
// cell can render a bold border on the side(s) that are walled off.
function wallFlags(walls) {
  const m = new Map();
  const flag = (r, c, side) => {
    const k = `${r},${c}`;
    if (!m.has(k)) m.set(k, {});
    m.get(k)[side] = true;
  };
  for (const w of walls) {
    if (w.r1 === w.r2) {
      const [cLeft, cRight] = w.c1 < w.c2 ? [w.c1, w.c2] : [w.c2, w.c1];
      flag(w.r1, cLeft, 'right');
      flag(w.r1, cRight, 'left');
    } else {
      const [rTop, rBottom] = w.r1 < w.r2 ? [w.r1, w.r2] : [w.r2, w.r1];
      flag(rTop, w.c1, 'bottom');
      flag(rBottom, w.c1, 'top');
    }
  }
  return m;
}

// Renders the board directly into `container` (which stays put across
// re-renders — only its children are rebuilt — so main.js can attach a
// single stable set of pointer listeners to it once at startup).
export function renderBoard(container, state) {
  clear(container);
  container.classList.add('zip-wrap');

  const { size, checkpoints, walls } = state.puzzle;
  const cpMap = checkpointMap(checkpoints);
  const wallMap = wallFlags(walls);

  const visitedIndex = new Map();
  state.path.forEach((cell, i) => visitedIndex.set(`${cell.r},${cell.c}`, i));
  const headKey = state.path.length ? `${state.path[state.path.length - 1].r},${state.path[state.path.length - 1].c}` : null;

  const board = el('div', {
    class: 'zip-board',
    style: `grid-template-columns: repeat(${size}, 1fr); grid-template-rows: repeat(${size}, 1fr);`,
    role: 'grid',
    'aria-label': 'Zip board',
  });

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const k = `${r},${c}`;
      const classes = ['zip-cell'];
      const wf = wallMap.get(k) || {};
      if (wf.right) classes.push('wall-right');
      if (wf.left) classes.push('wall-left');
      if (wf.top) classes.push('wall-top');
      if (wf.bottom) classes.push('wall-bottom');
      if (visitedIndex.has(k)) classes.push('visited');
      if (k === headKey) classes.push('head');

      const children = [];
      const cpNumber = cpMap.get(k);
      if (cpNumber !== undefined) {
        classes.push('checkpoint');
        if (visitedIndex.has(k)) classes.push('checkpoint-hit');
        children.push(el('span', { class: 'checkpoint-badge', text: String(cpNumber) }));
      }

      board.appendChild(
        el('div', { class: classes.join(' '), 'data-r': r, 'data-c': c }, children)
      );
    }
  }

  container.appendChild(board);
  container.appendChild(renderPathOverlay(state, size));
  return board;
}

function renderPathOverlay(state, size) {
  const overlay = svg('svg', {
    class: 'zip-overlay',
    viewBox: `0 0 ${size} ${size}`,
    'aria-hidden': 'true',
  });
  if (state.path.length > 1) {
    const points = state.path.map((cell) => `${cell.c + 0.5},${cell.r + 0.5}`).join(' ');
    overlay.appendChild(svg('polyline', { points, class: 'zip-path-line', fill: 'none' }));
  }
  return overlay;
}
