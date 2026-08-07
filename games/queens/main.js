import { makeRng } from '../shared/js/rng.js';
import { showModal, toast } from '../shared/js/modal.js';
import { generate } from './generator.js';
import { SIZE, findConflicts, nextHintCell } from './solver.js';
import { renderBoard, EMPTY, MARK_X, CROWN } from './render.js';

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
  return state.cells.map((row) => row.slice());
}

function newGame() {
  const rng = makeRng();
  const puzzle = generate(rng);
  state = {
    cells: Array.from({ length: puzzle.size }, () => Array(puzzle.size).fill(EMPTY)),
    regionGrid: puzzle.regionGrid,
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
  renderBoard(boardEl, state, { onSelect: cycle });
  undoBtn.disabled = history.length === 0;
}

function pushHistory() {
  history.push(snapshot());
  if (history.length > 200) history.shift();
}

function collectCrowns() {
  const crowns = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (state.cells[r][c] === CROWN) crowns.push({ r, c });
    }
  }
  return crowns;
}

// Click cycles a cell empty -> X-mark -> crown -> empty. X is a purely
// cosmetic scratch mark with no rule effect, matching the real game.
function cycle(r, c) {
  pushHistory();
  state.selected = [r, c];
  const next = (state.cells[r][c] + 1) % 3;
  state.cells[r][c] = next;

  if (state.autoCheck && next === CROWN) {
    const conflicts = findConflicts(state.regionGrid, collectCrowns());
    if (conflicts.has(`${r},${c}`)) {
      mistakes++;
      updateMistakeChip();
    }
  }

  render();
  checkWin();
}

function undo() {
  if (history.length === 0) return;
  state.cells = history.pop();
  render();
}

function hint() {
  const target = nextHintCell(state.regionGrid, collectCrowns(), state.solution);
  if (!target) {
    toast('No hints left — you’ve placed them all!');
    return;
  }
  pushHistory();
  state.cells[target.r][target.c] = CROWN;
  state.selected = [target.r, target.c];
  render();
  toast('Placed one crown for you');
  checkWin();
}

function isWin() {
  const crowns = collectCrowns();
  if (crowns.length !== SIZE) return false;
  return findConflicts(state.regionGrid, crowns).size === 0;
}

function checkWin() {
  if (!isWin()) return;
  showModal({
    title: 'Solved! 👑',
    message: mistakes === 0 ? 'Flawless run, no mistakes.' : `Solved with ${mistakes} mistake${mistakes === 1 ? '' : 's'}.`,
    actions: [
      { label: 'Play Again', primary: true, onClick: newGame },
      { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
    ],
  });
}

undoBtn.addEventListener('click', undo);
hintBtn.addEventListener('click', hint);
newGameBtn.addEventListener('click', newGame);
autoCheckToggle.addEventListener('change', () => {
  state.autoCheck = autoCheckToggle.checked;
  render();
});

newGame();
