import { makeRng } from '../shared/js/rng.js';
import { pickRandomUnused } from '../shared/js/storage.js';
import { showModal, toast } from '../shared/js/modal.js';
import { el, clear } from '../shared/js/dom.js';

const clueListEl = document.getElementById('clue-list');
const dotsEl = document.getElementById('progress-dots');
const scoreChip = document.getElementById('score-chip');
const form = document.getElementById('guess-form');
const input = document.getElementById('guess-input');
const newGameBtn = document.getElementById('new-game-btn');

const rng = makeRng();
let PINPOINT_DATA = [];
let puzzle = null;
let clueIndex = 0; // number of clues currently revealed - 1 (0-based index of latest clue)
let over = false;

const STOPWORDS = new Set([
  'a', 'an', 'the', 'that', 'are', 'is', 'of', 'in', 'on', 'and', 'or',
  'things', 'thing', 'types', 'type', 'kinds', 'kind', 'sorts', 'sort',
  'famous', 'world', 'classic', 'human',
]);

function normalizeWords(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, '')
    .split(/\s+/)
    .filter((w) => w && !STOPWORDS.has(w));
}

function isCorrectGuess(guess, category) {
  const g = normalizeWords(guess);
  if (g.length === 0) return false;
  const c = normalizeWords(category);
  const gs = new Set(g);
  const cs = new Set(c);
  const sameSet = gs.size === cs.size && [...gs].every((w) => cs.has(w));
  if (sameSet) return true;
  const subset = (small, big) => small.size > 0 && [...small].every((w) => big.has(w));
  return subset(gs, cs) || subset(cs, gs);
}

function loadPuzzle() {
  puzzle = pickRandomUnused(PINPOINT_DATA, 'pinpoint', rng);
  clueIndex = 0;
  over = false;
  input.disabled = false;
  input.value = '';
  form.querySelector('button').disabled = false;
  render();
}

function render() {
  clear(clueListEl);
  for (let i = 0; i < 5; i++) {
    const revealed = i <= clueIndex;
    clueListEl.appendChild(
      el('div', { class: `clue-bar ${revealed ? '' : 'pending'}` }, [
        el('span', { class: 'clue-num', text: String(i + 1) }),
        el('span', { class: 'clue-text', text: revealed ? puzzle.clues[i] : 'Locked' }),
      ])
    );
  }
  clear(dotsEl);
  for (let i = 0; i < 5; i++) {
    const used = i < clueIndex;
    const current = i === clueIndex;
    dotsEl.appendChild(el('span', { class: `dot ${used ? 'used' : ''} ${current ? 'current' : ''}` }));
  }
  const potential = 5 - clueIndex;
  scoreChip.textContent = `Worth: ${potential} point${potential === 1 ? '' : 's'}`;
}

function endGame(win, score) {
  over = true;
  input.disabled = true;
  form.querySelector('button').disabled = true;
  showModal({
    title: win ? 'Nailed it! 🎯' : 'Better luck next time',
    message: win
      ? `You guessed "${puzzle.category}" for ${score} point${score === 1 ? '' : 's'}.`
      : `The category was "${puzzle.category}". You'll get it next time!`,
    actions: [
      { label: 'Play Again', primary: true, onClick: loadPuzzle },
      { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
    ],
  });
}

function submitGuess(e) {
  e.preventDefault();
  if (over) return;
  const guess = input.value.trim();
  if (!guess) {
    toast('Type a guess first');
    return;
  }
  if (isCorrectGuess(guess, puzzle.category)) {
    const score = 5 - clueIndex;
    endGame(true, score);
    return;
  }
  input.value = '';
  if (clueIndex >= 4) {
    endGame(false, 0);
    return;
  }
  clueIndex++;
  render();
  toast('Not quite — next clue revealed');
}

form.addEventListener('submit', submitGuess);
newGameBtn.addEventListener('click', loadPuzzle);

fetch('data/pinpoint.json')
  .then((r) => r.json())
  .then((data) => {
    PINPOINT_DATA = data;
    loadPuzzle();
  });
