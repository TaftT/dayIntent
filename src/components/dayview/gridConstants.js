export const HOUR_HEIGHT = 82 // px per hour
export const PX_PER_MIN = HOUR_HEIGHT / 60
export const MIN_BLOCK_MINUTES = 10
export const DAY_MINUTES = 24 * 60
export const DAY_HEIGHT = DAY_MINUTES * PX_PER_MIN

// A 10-minute block only works out to ~12px tall at PX_PER_MIN — nowhere
// near enough to fit a readable line of text. Floor every block's rendered
// height so short items stay legible, same as Google Calendar does.
export const MIN_BLOCK_HEIGHT_PX = 26

// Overlapping instance blocks cascade (later-starting block on top) instead of
// splitting into equal columns. A block on top of another is inset from both
// sides so the one underneath shows around it:
//  - the right inset leaves the underneath block's complete-checkbox (which
//    sits at its right edge) visible, and grows one checkbox-width per level so
//    a third block doesn't cover the second's checkbox;
//  - the left offset grows a little per level.
// Past OVERLAP_MAX_LEVELS the insets stop growing so deep stacks stay readable.
const OVERLAP_FIRST_LEFT_PX = 44
const OVERLAP_LEFT_STEP_PX = 12
const OVERLAP_FIRST_RIGHT_PX = 34
const OVERLAP_RIGHT_STEP_PX = 30
const OVERLAP_MAX_LEVELS = 3

/** Extra left offset (beyond the 6px gutter) for a block at this stagger index. */
export function overlapLeftOffset(index) {
  if (index <= 0) return 0
  return OVERLAP_FIRST_LEFT_PX + (Math.min(index, OVERLAP_MAX_LEVELS) - 1) * OVERLAP_LEFT_STEP_PX
}

/** Extra right inset (beyond the 6px gutter) for a block at this stagger index. */
export function overlapRightInset(index) {
  if (index <= 0) return 0
  return OVERLAP_FIRST_RIGHT_PX + (Math.min(index, OVERLAP_MAX_LEVELS) - 1) * OVERLAP_RIGHT_STEP_PX
}

export function minutesToPx(minutes) {
  return minutes * PX_PER_MIN
}

export function pxToMinutes(px) {
  return px / PX_PER_MIN
}
