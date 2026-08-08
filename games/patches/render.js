import { el, clear } from '../shared/js/dom.js';

// Rotating pastel fill palette for placed rectangles, defined as CSS custom
// properties in patches.css (same spirit as Queens' --queens-color-* region
// palette) and read into a plain JS array here.
export function getPalette() {
  const styles = getComputedStyle(document.documentElement);
  const palette = [];
  for (let i = 0; i < 8; i++) {
    const v = styles.getPropertyValue(`--patches-color-${i}`).trim();
    if (v) palette.push(v);
  }
  return palette.length ? palette : ['#cfe8ff'];
}

const BADGE_GLYPH = {
  wide: '▭',
  tall: '▭',
  square: '▢',
};

function findClue(clues, r, c) {
  return clues.find((cl) => cl.r === r && cl.c === c) || null;
}

function rectStyle(rect) {
  return `grid-row:${rect.r0 + 1}/${rect.r1 + 2}; grid-column:${rect.c0 + 1}/${rect.c1 + 2};`;
}

// state: { rows, cols, clues, placedRects: [{r0,c0,r1,c1,color}], drag: {r0,c0,r1,c1,valid} | null, revealed }
export function renderBoard(container, state) {
  clear(container);
  const { rows, cols, clues, placedRects, drag } = state;

  const wrap = el('div', { class: 'patches-board-wrap' });

  const board = el('div', {
    class: 'patches-board',
    style: `--rows:${rows}; --cols:${cols};`,
    role: 'grid',
    'aria-label': 'Patches board',
  });

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const clue = findClue(clues, r, c);
      const cellChildren = [];
      if (clue) {
        const badgeChildren = [el('span', { class: 'patches-count', text: String(clue.count) })];
        if (clue.shape && clue.shape !== 'any') {
          badgeChildren.push(
            el('span', {
              class: `badge patches-shape-badge badge-${clue.shape}`,
              'aria-label': `${clue.shape} patch`,
              text: BADGE_GLYPH[clue.shape] || '',
            })
          );
        }
        cellChildren.push(el('span', { class: 'patches-clue' }, badgeChildren));
      }
      const cell = el('div', {
        class: 'patches-cell',
        'data-r': r,
        'data-c': c,
        'aria-label': `Row ${r + 1} column ${c + 1}`,
      }, cellChildren);
      board.appendChild(cell);
    }
  }
  wrap.appendChild(board);

  const overlay = el('div', {
    class: 'patches-overlay',
    style: `--rows:${rows}; --cols:${cols};`,
  });

  for (const rect of placedRects) {
    overlay.appendChild(
      el('div', {
        class: 'patches-rect',
        style: `${rectStyle(rect)} background-color:${rect.color};`,
      })
    );
  }

  if (drag) {
    overlay.appendChild(
      el('div', {
        class: `patches-rect preview${drag.valid ? '' : ' invalid'}`,
        style: rectStyle(drag),
      })
    );
  }

  wrap.appendChild(overlay);
  container.appendChild(wrap);
}
