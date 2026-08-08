import { el, clear } from '../shared/js/dom.js';
import { SIZE, SUN, MOON, findConflicts } from './solver.js';

let maskCounter = 0;

// Sun: solid circle + rays, colored via --accent-tango-sun in CSS.
function sunIcon() {
  return `<svg viewBox="0 0 24 24" class="tango-icon tango-sun" aria-hidden="true" focusable="false">
    <g class="rays">
      <line x1="12" y1="1" x2="12" y2="4"></line>
      <line x1="12" y1="20" x2="12" y2="23"></line>
      <line x1="1" y1="12" x2="4" y2="12"></line>
      <line x1="20" y1="12" x2="23" y2="12"></line>
      <line x1="4.2" y1="4.2" x2="6.3" y2="6.3"></line>
      <line x1="17.7" y1="17.7" x2="19.8" y2="19.8"></line>
      <line x1="4.2" y1="19.8" x2="6.3" y2="17.7"></line>
      <line x1="17.7" y1="6.3" x2="19.8" y2="4.2"></line>
    </g>
    <circle cx="12" cy="12" r="6"></circle>
  </svg>`;
}

// Moon: a crescent faked with a masked circle, colored via --accent-tango-moon.
// Each instance gets a unique mask id so multiple cells don't collide.
function moonIcon() {
  const id = `tango-moon-mask-${maskCounter++}`;
  return `<svg viewBox="0 0 24 24" class="tango-icon tango-moon" aria-hidden="true" focusable="false">
    <mask id="${id}">
      <rect x="0" y="0" width="24" height="24" fill="#fff"></rect>
      <circle cx="15.5" cy="8.5" r="7" fill="#000"></circle>
    </mask>
    <circle cx="12" cy="12" r="8" mask="url(#${id})"></circle>
  </svg>`;
}

export function renderBoard(container, state, { onTap }) {
  clear(container);
  const wrap = el('div', { class: 'tango-board-wrap' });
  const board = el('div', { class: 'tango-board', role: 'grid', 'aria-label': 'Tango board' });

  const conflicts = state.autoCheck
    ? findConflicts(state.grid, state.markers)
    : { cells: new Set(), markers: new Set() };

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      const val = state.grid[r][c];
      const isGiven = state.givenMask[r][c];
      const classes = ['tango-cell'];
      if (isGiven) classes.push('given');
      if (conflicts.cells.has(`${r},${c}`)) classes.push('conflict');

      const label =
        val === SUN ? ', sun' : val === MOON ? ', moon' : ', empty';

      const cell = el('button', {
        class: classes.join(' '),
        html: val === SUN ? sunIcon() : val === MOON ? moonIcon() : '',
        'aria-label': `Row ${r + 1} column ${c + 1}${label}`,
        onClick: () => !isGiven && onTap(r, c),
      });
      board.appendChild(cell);
    }
  }

  wrap.appendChild(board);
  wrap.appendChild(renderMarkers(state.markers, conflicts.markers));
  container.appendChild(wrap);
}

function renderMarkers(markers, badMarkers) {
  const layer = el('div', { class: 'tango-marker-layer', 'aria-hidden': 'true' });
  markers.forEach((m, i) => {
    const horizontal = m.r1 === m.r2;
    const cx = horizontal ? m.c1 + 1 : m.c1 + 0.5;
    const cy = horizontal ? m.r1 + 0.5 : m.r1 + 1;
    const classes = ['tango-marker'];
    if (badMarkers.has(i)) classes.push('bad');
    const badge = el('span', {
      class: classes.join(' '),
      text: m.type === 'SAME' ? '=' : '×',
      style: `left:${(cx / SIZE) * 100}%; top:${(cy / SIZE) * 100}%;`,
    });
    layer.appendChild(badge);
  });
  return layer;
}
