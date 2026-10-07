import { todayStr, addDaysStr, currentWeekRange } from './dateUtils.js'

const KEY = 'dayintent.statsRange'
const PRESET_DAYS = [1, 7, 30, 90]

const daysRange = (n) => {
  const to = todayStr()
  return { from: addDaysStr(to, -(n - 1)), to }
}

/**
 * What kind of selection a range is — stored instead of the raw dates so a
 * preset keeps meaning "this week" / "last 30 days" next time, rather than
 * freezing to the dates it happened to cover when it was picked.
 */
function describeRange({ from, to }) {
  const week = currentWeekRange()
  if (from === week.from && to === week.to) return { kind: 'week' }
  const n = PRESET_DAYS.find((d) => {
    const r = daysRange(d)
    return r.from === from && r.to === to
  })
  if (n) return { kind: 'days', days: n }
  return { kind: 'custom', from, to }
}

function resolveRange(d) {
  if (d?.kind === 'week') return currentWeekRange()
  if (d?.kind === 'days' && PRESET_DAYS.includes(d.days)) return daysRange(d.days)
  if (d?.kind === 'custom' && d.from && d.to) return { from: d.from, to: d.to }
  return null
}

/** The range last chosen on this device (recomputed for today), or this week. */
export function loadStatsRange() {
  try {
    const saved = resolveRange(JSON.parse(localStorage.getItem(KEY)))
    if (saved) return saved
  } catch {
    /* unreadable / unavailable storage — fall through to the default */
  }
  return currentWeekRange()
}

export function saveStatsRange(range) {
  try {
    localStorage.setItem(KEY, JSON.stringify(describeRange(range)))
  } catch {
    /* private mode etc. — the choice just won't persist */
  }
}
