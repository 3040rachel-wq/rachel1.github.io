import { makeRng } from '../shared/js/rng.js';
import { showModal, toast } from '../shared/js/modal.js';
import { generate } from './generator.js';
import { solveOne, SIZE } from './solver.js';
import { renderBoard, renderPalette } from './render.js';

const boardEl = document.getElementById('board');
const paletteEl = document.getElementById('palette');
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
  const puzzle = generate(rng, 15);
  state = {
    grid: puzzle.puzzle.map((row) => row.slice()),
    given: puzzle.given,
    solution: puzzle.solution,
    selected: null,
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
  renderBoard(boardEl, state, { onSelect: select });
  undoBtn.disabled = history.length === 0;
}

function select(r, c) {
  state.selected = [r, c];
  render();
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 100) history.shift();
}

function setDigit(v) {
  if (!state.selected) {
    toast('Select a cell first');
    return;
  }
  const [r, c] = state.selected;
  if (state.given[r][c]) return;
  pushHistory();
  const wasCorrectBefore = state.grid[r][c] === state.solution[r][c];
  state.grid[r][c] = v;
  if (state.autoCheck && v !== state.solution[r][c] && !wasCorrectBefore) {
    mistakes++;
    updateMistakeChip();
  }
  render();
  checkWin();
}

function eraseDigit() {
  if (!state.selected) return;
  const [r, c] = state.selected;
  if (state.given[r][c]) return;
  pushHistory();
  state.grid[r][c] = 0;
  render();
}

function undo() {
  if (history.length === 0) return;
  state.grid = history.pop();
  render();
}

function hint() {
  const solved = solveOne(state.grid) || state.solution;
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (!state.given[r][c] && state.grid[r][c] !== state.solution[r][c]) {
        pushHistory();
        state.grid[r][c] = state.solution[r][c];
        state.given[r][c] = true; // lock hinted cell so it can't be "un-hinted"
        render();
        toast('Filled one cell for you');
        checkWin();
        return;
      }
    }
  }
}

function isFull() {
  return state.grid.every((row) => row.every((v) => v !== 0));
}

function checkWin() {
  if (!isFull()) return;
  const correct = state.grid.every((row, r) => row.every((v, c) => v === state.solution[r][c]));
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

renderPalette(paletteEl, { onDigit: setDigit, onErase: eraseDigit });
undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', hint);
newGameBtn.addEventListener('click', newGame);
autoCheckToggle.addEventListener('change', () => {
  state.autoCheck = autoCheckToggle.checked;
  render();
});

newGame();
