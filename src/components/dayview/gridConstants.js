export const HOUR_HEIGHT = 82 // px per hour
export const PX_PER_MIN = HOUR_HEIGHT / 60
export const MIN_BLOCK_MINUTES = 10
export const DAY_MINUTES = 24 * 60
export const DAY_HEIGHT = DAY_MINUTES * PX_PER_MIN

// A 10-minute block only works out to ~12px tall at PX_PER_MIN — nowhere
// near enough to fit a readable line of text. Floor every block's rendered
// height so short items stay legible, same as Google Calendar does.
export const MIN_BLOCK_HEIGHT_PX = 26

// Overlapping instance blocks cascade rightward (later-starting block on top)
// rather than splitting into equal columns. A block on top of another sits
// inset from BOTH sides — OVERLAP_FIRST_OFFSET_PX in from the left and the same
// from the right, so it reads as centered and the one underneath is visible
// all around it. Each deeper level steps a further OVERLAP_STEP_PX to the right.
export const OVERLAP_FIRST_OFFSET_PX = 44
export const OVERLAP_STEP_PX = 20
export const OVERLAP_RIGHT_INSET_PX = OVERLAP_FIRST_OFFSET_PX

/** Extra left offset (beyond the 6px gutter) for a block at this stagger index. */
export function overlapLeftOffset(index) {
  return index <= 0 ? 0 : OVERLAP_FIRST_OFFSET_PX + (index - 1) * OVERLAP_STEP_PX
}

export function minutesToPx(minutes) {
  return minutes * PX_PER_MIN
}

export function pxToMinutes(px) {
  return px / PX_PER_MIN
}
