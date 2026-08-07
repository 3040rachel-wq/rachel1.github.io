import { makeRng } from '../shared/js/rng.js';
import { pickRandomUnused } from '../shared/js/storage.js';
import { showModal, toast } from '../shared/js/modal.js';
import { el, clear } from '../shared/js/dom.js';

const boardEl = document.getElementById('board');
const wordsEl = document.getElementById('words');
const newGameBtn = document.getElementById('new-game-btn');

const rng = makeRng();
let DATA = [];
let puzzle = null;
let tileById = new Map();
let adjacency = new Map(); // tileId -> Set(neighborTileId) minus walls
let claimedBy = new Map(); // tileId -> word index (or undefined)
let foundWords = new Set(); // indices of solved words
let selection = []; // array of tileIds currently being dragged
let dragging = false;

function tileKey(r, c) {
  return `${r},${c}`;
}

function buildAdjacency() {
  const byPos = new Map(puzzle.tiles.map((t) => [tileKey(t.r, t.c), t.id]));
  const wallSet = new Set(
    puzzle.walls.map((w) => (w.a < w.b ? `${w.a}-${w.b}` : `${w.b}-${w.a}`))
  );
  adjacency = new Map(puzzle.tiles.map((t) => [t.id, new Set()]));
  for (const t of puzzle.tiles) {
    const dirs = [
      [t.r - 1, t.c], [t.r + 1, t.c], [t.r, t.c - 1], [t.r, t.c + 1],
    ];
    for (const [r, c] of dirs) {
      const nid = byPos.get(tileKey(r, c));
      if (nid === undefined) continue;
      const edgeKey = t.id < nid ? `${t.id}-${nid}` : `${nid}-${t.id}`;
      if (wallSet.has(edgeKey)) continue;
      adjacency.get(t.id).add(nid);
    }
  }
}

function loadPuzzle() {
  puzzle = pickRandomUnused(DATA, 'wend', rng);
  tileById = new Map(puzzle.tiles.map((t) => [t.id, t]));
  claimedBy = new Map();
  foundWords = new Set();
  selection = [];
  buildAdjacency();
  render();
}

function wallSideClasses(tile) {
  const classes = [];
  const wallSet = new Set(
    puzzle.walls.map((w) => (w.a < w.b ? `${w.a}-${w.b}` : `${w.b}-${w.a}`))
  );
  const byPos = new Map(puzzle.tiles.map((t) => [tileKey(t.r, t.c), t.id]));
  const check = (dr, dc, cls) => {
    const nid = byPos.get(tileKey(tile.r + dr, tile.c + dc));
    if (nid === undefined) return;
    const edgeKey = tile.id < nid ? `${tile.id}-${nid}` : `${nid}-${tile.id}`;
    if (wallSet.has(edgeKey)) classes.push(cls);
  };
  check(-1, 0, 'wall-top');
  check(1, 0, 'wall-bottom');
  check(0, -1, 'wall-left');
  check(0, 1, 'wall-right');
  return classes;
}

function render() {
  clear(boardEl);
  clear(wordsEl);

  const maxR = Math.max(...puzzle.tiles.map((t) => t.r));
  const maxC = Math.max(...puzzle.tiles.map((t) => t.c));
  boardEl.style.gridTemplateRows = `repeat(${maxR + 1}, 1fr)`;
  boardEl.style.gridTemplateColumns = `repeat(${maxC + 1}, 1fr)`;

  for (const t of puzzle.tiles) {
    const claimedIdx = claimedBy.get(t.id);
    const classes = ['wend-tile', ...wallSideClasses(t)];
    if (claimedIdx !== undefined) classes.push(`claimed-${claimedIdx % 4}`);
    if (selection.includes(t.id)) classes.push('selected');
    const tileEl = el('div', {
      class: classes.join(' '),
      text: t.letter,
      style: `grid-row:${t.r + 1};grid-column:${t.c + 1};`,
      'data-tile-id': String(t.id),
    });
    boardEl.appendChild(tileEl);
  }

  puzzle.words.forEach((w, i) => {
    const found = foundWords.has(i);
    wordsEl.appendChild(
      el('span', {
        class: `word-chip ${found ? `found-${i % 4}` : ''}`,
        text: found ? w.answer : `${w.length} letters`,
      })
    );
  });
}

function tileIdFromPoint(x, y) {
  const elAt = document.elementFromPoint(x, y);
  const tileEl = elAt && elAt.closest ? elAt.closest('.wend-tile') : null;
  if (!tileEl) return null;
  return Number(tileEl.dataset.tileId);
}

function startSelection(tileId) {
  if (claimedBy.has(tileId)) return;
  dragging = true;
  selection = [tileId];
  render();
}

function extendSelection(tileId) {
  if (!dragging || tileId === null) return;
  if (claimedBy.has(tileId)) return;
  const last = selection[selection.length - 1];
  if (tileId === last) return;
  // Backtrack if re-entering the previous tile
  if (selection.length > 1 && tileId === selection[selection.length - 2]) {
    selection.pop();
    render();
    return;
  }
  if (selection.includes(tileId)) return;
  if (!adjacency.get(last)?.has(tileId)) return;
  selection.push(tileId);
  render();
}

function endSelection() {
  if (!dragging) return;
  dragging = false;
  if (selection.length >= 3) {
    const letters = selection.map((id) => tileById.get(id).letter).join('');
    const matchIdx = puzzle.words.findIndex(
      (w, i) => !foundWords.has(i) && w.length === selection.length && w.answer.toUpperCase() === letters.toUpperCase()
    );
    if (matchIdx !== -1) {
      selection.forEach((id) => claimedBy.set(id, matchIdx));
      foundWords.add(matchIdx);
      selection = [];
      render();
      toast(`Found ${puzzle.words[matchIdx].answer}!`);
      if (foundWords.size === puzzle.words.length) {
        showModal({
          title: 'Wound it up! 🧵',
          message: 'Every tile spelled — all four words found.',
          actions: [
            { label: 'Play Again', primary: true, onClick: loadPuzzle },
            { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
          ],
        });
      }
      return;
    }
  }
  selection = [];
  render();
}

boardEl.addEventListener('pointerdown', (e) => {
  const tileId = tileIdFromPoint(e.clientX, e.clientY);
  if (tileId !== null) {
    boardEl.setPointerCapture(e.pointerId);
    startSelection(tileId);
  }
});
boardEl.addEventListener('pointermove', (e) => {
  if (!dragging) return;
  const tileId = tileIdFromPoint(e.clientX, e.clientY);
  extendSelection(tileId);
});
boardEl.addEventListener('pointerup', endSelection);
boardEl.addEventListener('pointercancel', endSelection);

newGameBtn.addEventListener('click', loadPuzzle);

fetch('data/wend.json')
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    loadPuzzle();
  });
