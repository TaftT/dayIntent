export const HOUR_HEIGHT = 82 // px per hour
export const PX_PER_MIN = HOUR_HEIGHT / 60
export const MIN_BLOCK_MINUTES = 10
export const DAY_MINUTES = 24 * 60
export const DAY_HEIGHT = DAY_MINUTES * PX_PER_MIN

// A 10-minute block only works out to ~12px tall at PX_PER_MIN — nowhere
// near enough to fit a readable line of text. Floor every block's rendered
// height so short items stay legible, same as Google Calendar does.
export const MIN_BLOCK_HEIGHT_PX = 26

// Overlapping instance blocks cascade rightward by this many px per step
// (later-starting block on top), rather than splitting into equal columns.
export const OVERLAP_STAGGER_PX = 32

// A block sitting on top of another is also pulled in from the right edge by
// this much, so the one underneath stays visible on both sides instead of
// only peeking out at the left.
export const OVERLAP_RIGHT_INSET_PX = 36

export function minutesToPx(minutes) {
  return minutes * PX_PER_MIN
}

export function pxToMinutes(px) {
  return px / PX_PER_MIN
}
