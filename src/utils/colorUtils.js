/** @param {string} hex e.g. '#3b6fe0' @returns {'#000000'|'#ffffff'} readable text color */
export function contrastTextColor(hex) {
  const c = hex.replace('#', '')
  const r = parseInt(c.substring(0, 2), 16)
  const g = parseInt(c.substring(2, 4), 16)
  const b = parseInt(c.substring(4, 6), 16)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255
  return luminance > 0.6 ? '#000000' : '#ffffff'
}

// Reserved for items with no category — a faint, low-saturation gray that
// reads as "unset". Deliberately NOT in CATEGORY_COLOR_SWATCHES so a real
// category can never be given this color and collide with the uncategorized
// look. Kept as a hex (not a CSS var) because it's fed through
// contrastTextColor and `${color}3d` alpha math in the day-view blocks.
export const UNCATEGORIZED_COLOR = '#c9cdd3'

// New categories/groups cycle through these first, brightest colors.
export const DEFAULT_COLOR_SWATCHES = [
  '#3b6fe0',
  '#3ba76a',
  '#e0973b',
  '#d64545',
  '#8a5fd6',
  '#3bb0c9',
  '#e0517f',
]

// Everything offered in the color picker: the defaults plus extra hues and
// neutral grays. The grays are deliberately a bit darker than UNCATEGORIZED_COLOR
// so a real category/group never looks like "no category".
export const CATEGORY_COLOR_SWATCHES = [
  ...DEFAULT_COLOR_SWATCHES,
  '#e0c53b', // yellow
  '#7bc043', // lime
  '#2a9d8f', // teal
  '#4aa3f0', // sky
  '#5b5bd6', // indigo
  '#c2185b', // magenta
  '#b5651d', // rust
  '#b3b9c4', // light gray — a touch darker than the "no category" gray
  '#4a4f57', // charcoal
]
