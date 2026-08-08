import { makeRng } from '../shared/js/rng.js';
import { showModal, toast } from '../shared/js/modal.js';
import { generate } from './generator.js';
import { rectsOverlap, fullCoverage, validateSolution } from './validator.js';
import { renderBoard, getPalette } from './render.js';

const ROWS = 8;
const COLS = 8;

const boardEl = document.getElementById('board');
const undoBtn = document.getElementById('undo-btn');
const revealBtn = document.getElementById('reveal-btn');
const newGameBtn = document.getElementById('new-game-btn');
const progressChip = document.getElementById('progress-chip');

const palette = getPalette();

let state;
let dragState = null; // { startR, startC, pointerId }

function newGame() {
  const rng = makeRng();
  const puzzle = generate(rng, ROWS, COLS);
  state = {
    rows: puzzle.rows,
    cols: puzzle.cols,
    clues: puzzle.clues,
    solutionRects: puzzle.solutionRects,
    placedRects: [],
    drag: null,
    revealed: false,
  };
  dragState = null;
  render();
}

function render() {
  renderBoard(boardEl, state);
  undoBtn.disabled = state.revealed || state.placedRects.length === 0;
  revealBtn.disabled = state.revealed;
  const total = state.clues.length;
  progressChip.textContent = `Patches: ${state.placedRects.length} / ${total}`;
}

function nextColor() {
  return palette[state.placedRects.length % palette.length];
}

function boxFromDrag(r0, c0, r1, c1) {
  const rr0 = Math.min(r0, r1);
  const rr1 = Math.max(r0, r1);
  const cc0 = Math.min(c0, c1);
  const cc1 = Math.max(c0, c1);
  const box = { r0: rr0, c0: cc0, r1: rr1, c1: cc1 };
  box.valid = !state.placedRects.some((rect) => rectsOverlap(box, rect));
  return box;
}

function commitDrag(box) {
  state.placedRects.push({ r0: box.r0, c0: box.c0, r1: box.r1, c1: box.c1, color: nextColor() });
  render();
  checkWin();
}

function removeRectAt(r, c) {
  const idx = state.placedRects.findIndex(
    (rect) => r >= rect.r0 && r <= rect.r1 && c >= rect.c0 && c <= rect.c1
  );
  if (idx === -1) return false;
  state.placedRects.splice(idx, 1);
  render();
  return true;
}

function undo() {
  if (state.revealed || state.placedRects.length === 0) return;
  state.placedRects.pop();
  render();
}

function reveal() {
  if (state.revealed) return;
  state.placedRects = state.solutionRects.map((rect, i) => ({
    ...rect,
    color: palette[i % palette.length],
  }));
  state.drag = null;
  state.revealed = true;
  dragState = null;
  render();
  toast('Solution revealed');
}

function checkWin() {
  if (!fullCoverage(state.placedRects, state.rows, state.cols)) return;
  const result = validateSolution(state.placedRects, state.clues, state.rows, state.cols);
  if (result.valid) {
    showModal({
      title: 'Solved! 🎉',
      message: 'Every patch has exactly one clue, the right area, and the right shape.',
      actions: [
        { label: 'Play Again', primary: true, onClick: newGame },
        { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
      ],
    });
  } else {
    toast('Grid is full but something’s off — keep adjusting!');
  }
}

function cellFromEvent(e) {
  const target = document.elementFromPoint(e.clientX, e.clientY);
  const cellEl = target && target.closest ? target.closest('.patches-cell') : null;
  if (!cellEl) return null;
  return [Number(cellEl.dataset.r), Number(cellEl.dataset.c)];
}

function onPointerDown(e) {
  if (!state.revealed && e.button !== undefined && e.button !== 0) return;
  if (state.revealed) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  const [r, c] = cell;

  if (removeRectAt(r, c)) return;

  dragState = { startR: r, startC: c, pointerId: e.pointerId };
  try {
    boardEl.setPointerCapture(e.pointerId);
  } catch {
    /* pointer capture unsupported — drag still works via document hit-testing */
  }
  state.drag = boxFromDrag(r, c, r, c);
  render();
  e.preventDefault();
}

function onPointerMove(e) {
  if (!dragState) return;
  const cell = cellFromEvent(e);
  if (!cell) return;
  const [r, c] = cell;
  state.drag = boxFromDrag(dragState.startR, dragState.startC, r, c);
  render();
}

function endDrag(e) {
  if (!dragState) return;
  if (e && e.pointerId !== undefined) {
    try {
      boardEl.releasePointerCapture(e.pointerId);
    } catch {
      /* no-op */
    }
  }
  const box = state.drag;
  dragState = null;
  state.drag = null;
  if (box && box.valid) {
    commitDrag(box);
  } else {
    if (box && !box.valid) toast('That overlaps an existing patch');
    render();
  }
}

boardEl.addEventListener('pointerdown', onPointerDown);
boardEl.addEventListener('pointermove', onPointerMove);
boardEl.addEventListener('pointerup', endDrag);
boardEl.addEventListener('pointercancel', endDrag);

undoBtn.addEventListener('click', undo);
revealBtn.addEventListener('click', reveal);
newGameBtn.addEventListener('click', newGame);

newGame();
