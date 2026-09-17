import { addDaysStr, todayStr } from './dateUtils.js'

const HISTORY_DAYS = 30

// When more than one item shares a day, the best outcome wins — e.g. the
// habit's own recurring instance was skipped but a same-named one-off item
// got marked complete, that day still reads as done.
const STATUS_PRIORITY = { completed: 3, worked_on: 2, ghost: 1 }

/**
 * Computes habit statistics for one item from its finalized instance
 * history: completion rate, current streak, longest streak, and a
 * day-by-day status strip for the last 30 days. Also folds in occurrences
 * from any other item that happens to share this habit's title (trimmed,
 * case-insensitive) — a one-off task named the same as a habit still counts
 * toward it, rather than needing to be the exact recurring item record.
 * @param {import('../data/types.js').Item} habitItem
 * @param {import('../data/types.js').Item[]} allItems
 * @param {import('../data/types.js').ScheduledInstance[]} allInstances
 */
export function computeHabitStats(habitItem, allItems, allInstances) {
  const normalizedTitle = habitItem.title.trim().toLowerCase()
  const matchingItemIds = new Set(
    allItems.filter((i) => i.title.trim().toLowerCase() === normalizedTitle).map((i) => i.id)
  )

  const today = todayStr()
  const mine = allInstances.filter((i) => matchingItemIds.has(i.itemId))

  // Today's occurrence isn't finalized until the next day's rollover, so
  // without this a habit marked done *today* wouldn't show on the strip or
  // count toward the streak until tomorrow. Fold in the live status of any
  // not-yet-finalized occurrence up to today, but only when it's actually
  // been acted on — an untouched "pending" today shouldn't read as a miss.
  const liveStatus = (inst) => {
    if (inst.percentComplete >= 100) return 'completed'
    if (inst.startPercent != null && inst.percentComplete > inst.startPercent) return 'worked_on'
    return null
  }
  const contributions = []
  for (const inst of mine) {
    if (inst.finalized) {
      contributions.push({ date: inst.date, status: inst.status })
    } else if (inst.date <= today) {
      const status = liveStatus(inst)
      if (status) contributions.push({ date: inst.date, status })
    }
  }

  // Merge same-titled items' occurrences onto a single per-date status
  // before computing streaks — otherwise two items landing on the same date
  // would count as two separate days instead of one.
  const statusByDate = new Map()
  for (const { date, status } of contributions) {
    const existing = statusByDate.get(date)
    if (!existing || STATUS_PRIORITY[status] > STATUS_PRIORITY[existing]) {
      statusByDate.set(date, status)
    }
  }
  const dates = Array.from(statusByDate.keys()).sort()

  const totalOccurrences = dates.length
  const completedCount = dates.filter((d) => statusByDate.get(d) === 'completed').length
  const completionRate = totalOccurrences === 0 ? 0 : Math.round((completedCount / totalOccurrences) * 100)

  let currentStreak = 0
  for (let i = dates.length - 1; i >= 0; i--) {
    if (statusByDate.get(dates[i]) === 'completed') currentStreak++
    else break
  }

  let longestStreak = 0
  let running = 0
  for (const date of dates) {
    if (statusByDate.get(date) === 'completed') {
      running++
      longestStreak = Math.max(longestStreak, running)
    } else {
      running = 0
    }
  }

  const history = Array.from({ length: HISTORY_DAYS }, (_, i) => {
    const date = addDaysStr(today, i - (HISTORY_DAYS - 1))
    return { date, status: statusByDate.get(date) ?? null }
  })

  return { totalOccurrences, completedCount, completionRate, currentStreak, longestStreak, history }
}
