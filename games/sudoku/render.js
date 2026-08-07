import { el, clear } from '../shared/js/dom.js';
import { SIZE, BOX_R, BOX_C, findConflicts } from './solver.js';

export function renderBoard(container, state, { onSelect }) {
  clear(container);
  const board = el('div', { class: 'sudoku-board', role: 'grid', 'aria-label': 'Sudoku board' });
  const conflicts = state.autoCheck ? findConflicts(state.grid) : new Set();

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = state.grid[r][c];
      const isGiven = state.given[r][c];
      const classes = ['sudoku-cell'];
      if (isGiven) classes.push('given');
      if (state.selected && state.selected[0] === r && state.selected[1] === c) classes.push('selected');
      if (conflicts.has(`${r},${c}`)) classes.push('conflict');
      if ((c + 1) % BOX_C === 0 && c !== SIZE - 1) classes.push('box-right');
      if ((r + 1) % BOX_R === 0 && r !== SIZE - 1) classes.push('box-bottom');

      const cell = el('button', {
        class: classes.join(' '),
        text: val ? String(val) : '',
        'aria-label': `Row ${r + 1} column ${c + 1}`,
        onClick: () => !isGiven && onSelect(r, c),
      });
      board.appendChild(cell);
    }
  }
  container.appendChild(board);
}

export function renderPalette(container, { onDigit, onErase }) {
  clear(container);
  const wrap = el('div', { class: 'sudoku-palette' });
  for (let v = 1; v <= SIZE; v++) {
    wrap.appendChild(el('button', { text: String(v), onClick: () => onDigit(v) }));
  }
  wrap.appendChild(el('button', { class: 'erase', text: '⌫', 'aria-label': 'Erase', onClick: onErase }));
  container.appendChild(wrap);
}
