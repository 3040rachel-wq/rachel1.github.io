import { el, clear } from '../shared/js/dom.js';
import { SIZE, findConflicts } from './solver.js';

// Mirrors the --queens-color-0..8 custom properties in
// games/shared/css/tokens.css — kept as a plain array here since inline
// per-cell background colors are simplest set directly from JS.
export const REGION_COLORS = [
  '#f6c9c9', '#c9e4f6', '#d8f6c9', '#f6ecc9', '#e0c9f6',
  '#c9f6ec', '#f6c9e6', '#d9d9d9', '#c9d3f6',
];

export const EMPTY = 0;
export const MARK_X = 1;
export const CROWN = 2;

export function renderBoard(container, state, { onSelect }) {
  clear(container);
  const board = el('div', { class: 'queens-board', role: 'grid', 'aria-label': 'Queens board' });

  const placedCrowns = [];
  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (state.cells[r][c] === CROWN) placedCrowns.push({ r, c });
    }
  }
  const conflicts = state.autoCheck ? findConflicts(state.regionGrid, placedCrowns) : new Set();

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = state.cells[r][c];
      const region = state.regionGrid[r][c];
      const classes = ['queens-cell'];
      if (state.selected && state.selected[0] === r && state.selected[1] === c) classes.push('selected');
      if (conflicts.has(`${r},${c}`)) classes.push('conflict');

      let glyph = '';
      let label = `Row ${r + 1} column ${c + 1}, empty`;
      if (val === CROWN) {
        glyph = '♛';
        classes.push('crown');
        label = `Row ${r + 1} column ${c + 1}, crown`;
      } else if (val === MARK_X) {
        glyph = '✕';
        classes.push('mark');
        label = `Row ${r + 1} column ${c + 1}, marked`;
      }

      const cell = el('button', {
        class: classes.join(' '),
        style: `background-color:${REGION_COLORS[region % REGION_COLORS.length]}`,
        text: glyph,
        'aria-label': label,
        onClick: () => onSelect(r, c),
      });
      board.appendChild(cell);
    }
  }
  container.appendChild(board);
}
