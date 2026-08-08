// Pure-function validators for Patches (Shikaku-style rectangle partition).
// Used both by generator.js (as a self-check against its own solutionRects)
// and by main.js (as the live win-check against the player's placed
// rectangles). Deliberately validates rectangles against the general rules
// rather than requiring an exact match to the generator's specific
// partition — any rectangle set that satisfies the rules is a win.

// Inclusive-coordinate rectangle: { r0, c0, r1, c1 } with r0<=r1, c0<=c1.

export function rectArea(rect) {
  return (rect.r1 - rect.r0 + 1) * (rect.c1 - rect.c0 + 1);
}

export function rectsOverlap(a, b) {
  return a.r0 <= b.r1 && b.r0 <= a.r1 && a.c0 <= b.c1 && b.c0 <= a.c1;
}

// True only if every cell in the rows x cols grid is covered by exactly
// one of `rects` — i.e. no gaps and no overlaps.
export function fullCoverage(rects, rows, cols) {
  const coverage = Array.from({ length: rows }, () => Array(cols).fill(0));
  for (const rect of rects) {
    if (rect.r0 < 0 || rect.c0 < 0 || rect.r1 >= rows || rect.c1 >= cols || rect.r0 > rect.r1 || rect.c0 > rect.c1) {
      return false;
    }
    for (let r = rect.r0; r <= rect.r1; r++) {
      for (let c = rect.c0; c <= rect.c1; c++) coverage[r][c]++;
    }
  }
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      if (coverage[r][c] !== 1) return false;
    }
  }
  return true;
}

export function rectContainsExactlyOneClue(rect, clues) {
  let count = 0;
  for (const clue of clues) {
    if (clue.r >= rect.r0 && clue.r <= rect.r1 && clue.c >= rect.c0 && clue.c <= rect.c1) count++;
  }
  return count === 1;
}

// shapeConstraint: 'any' | 'wide' | 'tall' | 'square' | falsy (== 'any')
export function shapeMatches(rect, shapeConstraint) {
  if (!shapeConstraint || shapeConstraint === 'any') return true;
  const width = rect.c1 - rect.c0 + 1;
  const height = rect.r1 - rect.r0 + 1;
  if (shapeConstraint === 'wide') return width > height;
  if (shapeConstraint === 'tall') return height > width;
  if (shapeConstraint === 'square') return width === height;
  return true;
}

function fmtRect(rect) {
  return `[${rect.r0},${rect.c0}]-[${rect.r1},${rect.c1}]`;
}

// Top-level win/solution check. Returns { valid, errors }.
// Covers: rectangle sanity, full grid coverage (no gaps/overlaps), exactly
// one clue per rectangle, area match, and shape match when constrained.
export function validateSolution(rects, clues, rows, cols) {
  const errors = [];

  for (const rect of rects) {
    if (
      rect.r0 > rect.r1 ||
      rect.c0 > rect.c1 ||
      rect.r0 < 0 ||
      rect.c0 < 0 ||
      rect.r1 >= rows ||
      rect.c1 >= cols
    ) {
      errors.push(`Invalid rectangle bounds: ${fmtRect(rect)}`);
    }
  }
  if (errors.length > 0) return { valid: false, errors };

  if (!fullCoverage(rects, rows, cols)) {
    const coverage = Array.from({ length: rows }, () => Array(cols).fill(0));
    for (const rect of rects) {
      for (let r = rect.r0; r <= rect.r1; r++) {
        for (let c = rect.c0; c <= rect.c1; c++) coverage[r][c]++;
      }
    }
    let gaps = 0;
    let overlaps = 0;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        if (coverage[r][c] === 0) gaps++;
        else if (coverage[r][c] > 1) overlaps++;
      }
    }
    if (gaps > 0) errors.push(`${gaps} cell(s) not covered by any patch`);
    if (overlaps > 0) errors.push(`${overlaps} cell(s) covered by more than one patch`);
  }

  for (const rect of rects) {
    const cluesInRect = clues.filter(
      (cl) => cl.r >= rect.r0 && cl.r <= rect.r1 && cl.c >= rect.c0 && cl.c <= rect.c1
    );
    if (cluesInRect.length === 0) {
      errors.push(`Patch ${fmtRect(rect)} has no clue`);
      continue;
    }
    if (cluesInRect.length > 1) {
      errors.push(`Patch ${fmtRect(rect)} contains ${cluesInRect.length} clues (must be exactly 1)`);
      continue;
    }
    const clue = cluesInRect[0];
    const area = rectArea(rect);
    if (area !== clue.count) {
      errors.push(`Patch ${fmtRect(rect)} has area ${area}, expected ${clue.count}`);
    }
    if (!shapeMatches(rect, clue.shape)) {
      errors.push(`Patch ${fmtRect(rect)} shape doesn't match clue requirement "${clue.shape}"`);
    }
  }

  for (const clue of clues) {
    const owners = rects.filter(
      (rect) => clue.r >= rect.r0 && clue.r <= rect.r1 && clue.c >= rect.c0 && clue.c <= rect.c1
    );
    if (owners.length !== 1) {
      errors.push(`Clue at (${clue.r},${clue.c}) is covered by ${owners.length} patch(es), expected 1`);
    }
  }

  return { valid: errors.length === 0, errors };
}
