import { makeRng } from '../shared/js/rng.js';
import { showModal, toast } from '../shared/js/modal.js';
import { key } from '../shared/js/grid.js';
import { generate } from './generator.js';
import { SIZE, makeWallSet, isWalled, isWinningPath, computeHint } from './solver.js';
import { renderBoard } from './render.js';

const boardEl = document.getElementById('board');
const undoBtn = document.getElementById('undo-btn');
const hintBtn = document.getElementById('hint-btn');
const newGameBtn = document.getElementById('new-game-btn');
const progressChip = document.getElementById('progress-chip');

let puzzle; // generator output: { size, path (solution), checkpoints, walls }
let cpMap; // "r,c" -> checkpoint number
let wallSet; // Set of edge keys the path may never cross
let state; // { path: [{r,c}] } — player's current drawn path
let dragging = false;

function newGame() {
  const rng = makeRng();
  puzzle = generate(rng, SIZE);
  cpMap = new Map(puzzle.checkpoints.map((cp) => [key(cp.r, cp.c), cp.number]));
  wallSet = makeWallSet(puzzle.walls);
  state = { puzzle, path: [] };
  dragging = false;
  render();
}

function render() {
  renderBoard(boardEl, state);
  const total = puzzle.size * puzzle.size;
  progressChip.textContent = `${state.path.length} / ${total}`;
  undoBtn.disabled = state.path.length === 0;
}

function cellAt(r, c) {
  return { r, c };
}

function lastCell() {
  return state.path.length ? state.path[state.path.length - 1] : null;
}

function currentMaxCheckpoint() {
  let max = 0;
  for (const cell of state.path) {
    const n = cpMap.get(key(cell.r, cell.c));
    if (n !== undefined && n > max) max = n;
  }
  return max;
}

function isAdjacent(a, b) {
  return (Math.abs(a.r - b.r) === 1 && a.c === b.c) || (Math.abs(a.c - b.c) === 1 && a.r === b.r);
}

function pathHas(r, c) {
  return state.path.some((cell) => cell.r === r && cell.c === c);
}

// Can the path legally extend from its current head onto (r,c)?
function canExtendTo(r, c) {
  const head = lastCell();
  if (!head) return false;
  if (pathHas(r, c)) return false;
  if (!isAdjacent(head, cellAt(r, c))) return false;
  if (isWalled(wallSet, head.r, head.c, r, c)) return false;
  const cpNum = cpMap.get(key(r, c));
  if (cpNum !== undefined && cpNum !== currentMaxCheckpoint() + 1) return false;
  return true;
}

function cellFromEvent(e) {
  const rect = boardEl.getBoundingClientRect();
  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;
  if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
  const size = puzzle.size;
  const c = Math.min(size - 1, Math.max(0, Math.floor((x / rect.width) * size)));
  const r = Math.min(size - 1, Math.max(0, Math.floor((y / rect.height) * size)));
  return { r, c };
}

function onPointerDown(e) {
  const cell = cellFromEvent(e);
  if (!cell) return;

  if (state.path.length === 0) {
    // Path must always start on checkpoint #1.
    if (cpMap.get(key(cell.r, cell.c)) !== 1) return;
    state.path = [cellAt(cell.r, cell.c)];
    dragging = true;
    boardEl.setPointerCapture(e.pointerId);
    render();
    return;
  }

  // Resume dragging only from the path's current end.
  const head = lastCell();
  if (head.r === cell.r && head.c === cell.c) {
    dragging = true;
    boardEl.setPointerCapture(e.pointerId);
  }
}

function onPointerMove(e) {
  if (!dragging) return;
  const cell = cellFromEvent(e);
  if (!cell) return;

  const head = lastCell();
  if (!head) return;
  if (head.r === cell.r && head.c === cell.c) return; // no change

  // Dragging back onto the immediately-previous cell undoes the last segment.
  if (state.path.length >= 2) {
    const prev = state.path[state.path.length - 2];
    if (prev.r === cell.r && prev.c === cell.c) {
      state.path.pop();
      render();
      return;
    }
  }

  if (canExtendTo(cell.r, cell.c)) {
    state.path.push(cellAt(cell.r, cell.c));
    render();
    checkWin();
  }
  // Illegal targets (non-adjacent, visited, wall-blocked, out-of-order
  // checkpoint) are structurally rejected — the drag simply doesn't extend.
}

function onPointerEnd(e) {
  dragging = false;
  if (boardEl.hasPointerCapture && boardEl.hasPointerCapture(e.pointerId)) {
    boardEl.releasePointerCapture(e.pointerId);
  }
}

function undo() {
  if (state.path.length === 0) return;
  state.path.pop();
  render();
}

function hint() {
  const { path, corrected, revealed } = computeHint(state.path, puzzle.path);
  state.path = path;
  render();
  if (!revealed) {
    toast('You are already on the solved path — keep going!');
  } else if (corrected) {
    toast('That drifted off course — rewound to your last correct step.');
  } else {
    toast('Here is your next step.');
  }
  checkWin();
}

function checkWin() {
  const total = puzzle.size * puzzle.size;
  if (state.path.length !== total) return;
  if (isWinningPath(state.path, puzzle.size, puzzle.checkpoints)) {
    showModal({
      title: 'Zipped! ⚡',
      message: 'You connected every cell in one continuous path.',
      actions: [
        { label: 'Play Again', primary: true, onClick: newGame },
        { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
      ],
    });
  }
}

boardEl.addEventListener('pointerdown', onPointerDown);
boardEl.addEventListener('pointermove', onPointerMove);
boardEl.addEventListener('pointerup', onPointerEnd);
boardEl.addEventListener('pointercancel', onPointerEnd);

undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', hint);
newGameBtn.addEventListener('click', newGame);

newGame();
