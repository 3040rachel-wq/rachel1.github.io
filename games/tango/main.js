import { makeRng } from '../shared/js/rng.js';
import { showModal, toast } from '../shared/js/modal.js';
import { generate } from './generator.js';
import { SIZE, EMPTY, SUN, MOON, findConflicts } from './solver.js';
import { renderBoard } from './render.js';

const boardEl = document.getElementById('board');
const undoBtn = document.getElementById('undo-btn');
const hintBtn = document.getElementById('hint-btn');
const newGameBtn = document.getElementById('new-game-btn');
const autoCheckToggle = document.getElementById('auto-check-toggle');
const mistakeChip = document.getElementById('mistake-chip');

let state;
let history;
let mistakes;

function snapshot() {
  return state.grid.map((row) => row.slice());
}

function newGame() {
  const rng = makeRng();
  const puzzle = generate(rng);
  const grid = Array.from({ length: SIZE }, (_, r) =>
    Array.from({ length: SIZE }, (_, c) => (puzzle.givenMask[r][c] ? puzzle.grid[r][c] : EMPTY))
  );
  state = {
    grid,
    givenMask: puzzle.givenMask.map((row) => row.slice()),
    markers: puzzle.markers,
    solution: puzzle.grid,
    autoCheck: autoCheckToggle.checked,
  };
  history = [];
  mistakes = 0;
  updateMistakeChip();
  render();
}

function updateMistakeChip() {
  mistakeChip.textContent = `Mistakes: ${mistakes}`;
}

function render() {
  renderBoard(boardEl, state, { onTap: tapCell });
  undoBtn.disabled = history.length === 0;
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 100) history.shift();
}

// Empty -> Sun -> Moon -> Empty
function tapCell(r, c) {
  if (state.givenMask[r][c]) return;
  pushHistory();
  const cur = state.grid[r][c];
  const next = cur === EMPTY ? SUN : cur === SUN ? MOON : EMPTY;
  const wasCorrectBefore = cur !== EMPTY && cur === state.solution[r][c];
  state.grid[r][c] = next;
  if (state.autoCheck && next !== EMPTY && next !== state.solution[r][c] && !wasCorrectBefore) {
    mistakes++;
    updateMistakeChip();
  }
  render();
  checkWin();
}

function undo() {
  if (history.length === 0) return;
  state.grid = history.pop();
  render();
}

function hint() {
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!state.givenMask[r][c] && state.grid[r][c] !== state.solution[r][c]) {
        pushHistory();
        state.grid[r][c] = state.solution[r][c];
        state.givenMask[r][c] = true; // lock hinted cell so it can't be "un-hinted"
        render();
        toast('Filled one cell for you');
        checkWin();
        return;
      }
    }
  }
}

function isFull() {
  return state.grid.every((row) => row.every((v) => v !== EMPTY));
}

function checkWin() {
  if (!isFull()) return;
  const conflicts = findConflicts(state.grid, state.markers);
  const correct = conflicts.cells.size === 0 && conflicts.markers.size === 0;
  if (correct) {
    showModal({
      title: 'Solved! 🎉',
      message: mistakes === 0 ? 'Flawless run, no mistakes.' : `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`,
      actions: [
        { label: 'Play Again', primary: true, onClick: newGame },
        { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
      ],
    });
  } else {
    toast('Grid is full but something’s off — keep adjusting!');
  }
}

undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', hint);
newGameBtn.addEventListener('click', newGame);
autoCheckToggle.addEventListener('change', () => {
  state.autoCheck = autoCheckToggle.checked;
  render();
});

newGame();
