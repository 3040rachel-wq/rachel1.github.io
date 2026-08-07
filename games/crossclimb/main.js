import { makeRng } from '../shared/js/rng.js';
import { pickRandomUnused } from '../shared/js/storage.js';
import { showModal, toast } from '../shared/js/modal.js';
import { el, clear } from '../shared/js/dom.js';

const phaseLabel = document.getElementById('phase-label');
const ladderEl = document.getElementById('ladder');
const comboBoxEl = document.getElementById('combo-box');
const newGameBtn = document.getElementById('new-game-btn');

const rng = makeRng();
let DATA = [];
let puzzle = null;

// rows: array of 5 { clue, answer, solved } in the player's CURRENT order
// (starts as the scrambled `middle` order; reordering during phase 2
// swaps entries within this array).
let rows = [];
let phase = 'clue'; // 'clue' | 'reorder' | 'combo' | 'won'

function normalize(s) {
  return (s || '').trim().toUpperCase();
}

function hamming1(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) diff++;
  return diff === 1;
}

function loadPuzzle() {
  puzzle = pickRandomUnused(DATA, 'crossclimb', rng);
  rows = puzzle.middle.map((m) => ({ clue: m.clue, answer: m.answer, solved: false }));
  phase = 'clue';
  render();
}

function allSolved() {
  return rows.every((r) => r.solved);
}

function linkOk(i) {
  // is rows[i] <-> rows[i+1] a valid one-letter-change link?
  return hamming1(rows[i].answer, rows[i + 1].answer);
}

function allLinksOk() {
  for (let i = 0; i < rows.length - 1; i++) if (!linkOk(i)) return false;
  return true;
}

function render() {
  clear(ladderEl);
  clear(comboBoxEl);
  comboBoxEl.style.display = 'none';

  if (phase === 'clue' || phase === 'reorder') {
    phaseLabel.textContent =
      phase === 'clue' ? 'Step 1 — Answer the clues' : 'Step 2 — Put the ladder in order';

    // top locked rung (visual only until phase === 'combo'+)
    ladderEl.appendChild(el('div', { class: 'rung locked', text: '🔒 Locked' }));

    rows.forEach((row, i) => {
      const children = [];
      if (row.solved) {
        children.push(
          el(
            'div',
            { class: 'tile-row' },
            row.answer.split('').map((ch) => el('span', { class: 'tile', text: ch }))
          )
        );
      } else {
        children.push(el('span', { class: 'clue-text', text: row.clue }));
        const input = el('input', {
          type: 'text',
          maxlength: String(row.answer.length),
          placeholder: `${row.answer.length} letters`,
          onKeydown: (e) => {
            if (e.key === 'Enter') tryAnswer(i, input.value);
          },
        });
        children.push(input);
        children.push(el('button', { class: 'btn btn-secondary', text: 'Check', onClick: () => tryAnswer(i, input.value) }));
      }

      if (phase === 'reorder' && row.solved) {
        const upDisabled = i === 0;
        const downDisabled = i === rows.length - 1;
        children.push(
          el('div', { class: 'reorder-controls' }, [
            el('button', { text: '▲', disabled: upDisabled, onClick: () => moveRow(i, -1) }),
            el('button', { text: '▼', disabled: downDisabled, onClick: () => moveRow(i, 1) }),
          ])
        );
      }

      const classes = ['rung'];
      if (row.solved) classes.push('solved-move');
      if (phase === 'reorder' && i < rows.length - 1 && linkOk(i)) classes.push('link-ok');
      ladderEl.appendChild(el('div', { class: classes.join(' ') }, children));
    });

    ladderEl.appendChild(el('div', { class: 'rung locked', text: '🔒 Locked' }));

    if (phase === 'reorder') {
      const ready = allLinksOk();
      ladderEl.appendChild(
        el('button', {
          class: 'btn btn-primary',
          text: ready ? 'Lock In Order ✓' : 'Check order (arrange so neighbors differ by 1 letter)',
          disabled: !ready,
          style: 'margin-top:8px;width:100%;',
          onClick: enterComboPhase,
        })
      );
    }
  } else if (phase === 'combo' || phase === 'won') {
    phaseLabel.textContent = 'Step 3 — Solve the ends';
    ladderEl.style.display = 'none';
    comboBoxEl.style.display = 'block';
    comboBoxEl.appendChild(el('p', { class: 'combo-clue', text: puzzle.comboClue }));
    const topInput = el('input', { type: 'text', placeholder: 'Top word', maxlength: String(puzzle.topWord.length) });
    const bottomInput = el('input', { type: 'text', placeholder: 'Bottom word', maxlength: String(puzzle.bottomWord.length) });
    comboBoxEl.appendChild(el('div', { class: 'combo-inputs' }, [topInput, bottomInput]));
    comboBoxEl.appendChild(
      el('button', {
        class: 'btn btn-primary',
        text: 'Submit',
        style: 'margin-top:12px;',
        onClick: () => checkCombo(topInput.value, bottomInput.value),
      })
    );
  }
}

function tryAnswer(i, value) {
  if (normalize(value) === normalize(rows[i].answer)) {
    rows[i].solved = true;
    render();
    if (allSolved()) {
      phase = 'reorder';
      toast('All clues solved — now put the ladder in order!');
      render();
    }
  } else {
    toast('Not quite — try again');
  }
}

function moveRow(i, dir) {
  const j = i + dir;
  if (j < 0 || j >= rows.length) return;
  [rows[i], rows[j]] = [rows[j], rows[i]];
  render();
}

function enterComboPhase() {
  if (!allLinksOk()) return;
  phase = 'combo';
  render();
}

function checkCombo(topGuess, bottomGuess) {
  const topOk = normalize(topGuess) === normalize(puzzle.topWord);
  const bottomOk = normalize(bottomGuess) === normalize(puzzle.bottomWord);
  if (topOk && bottomOk) {
    phase = 'won';
    showModal({
      title: 'Climbed it! 🪜',
      message: `${puzzle.topWord} / ${puzzle.bottomWord} — ladder complete.`,
      actions: [
        { label: 'Play Again', primary: true, onClick: loadPuzzle },
        { label: 'Back to Hub', onClick: () => (window.location.href = '../') },
      ],
    });
  } else {
    toast('Not quite — check both words');
  }
}

newGameBtn.addEventListener('click', loadPuzzle);

fetch('data/crossclimb.json')
  .then((r) => r.json())
  .then((data) => {
    DATA = data;
    loadPuzzle();
  });
