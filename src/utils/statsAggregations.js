import { addDaysStr } from './dateUtils.js'
import { UNCATEGORIZED_COLOR } from './colorUtils.js'

const UNCATEGORIZED = { categoryId: null, name: 'Uncategorized', color: UNCATEGORIZED_COLOR }

/**
 * Time spent per category over a date range, counted from finalized
 * instances only — a "completed" instance contributes its full duration, a
 * "worked_on" one contributes its duration pro-rated by how far it got
 * (finalPercent). Pending/ghost instances and durationless reminders don't
 * count. Instances whose item was deleted, or whose item has no category,
 * fall into an "Uncategorized" bucket.
 *
 * @param {import('../data/types.js').ScheduledInstance[]} instances
 * @param {import('../data/types.js').Item[]} items
 * @param {import('../data/types.js').Category[]} categories
 * @param {string} fromDate 'YYYY-MM-DD' inclusive
 * @param {string} toDate 'YYYY-MM-DD' inclusive
 * @returns {{ rows: {categoryId: string|null, name: string, color: string, minutes: number}[], totalMinutes: number }}
 */
export function computeCategoryTime(instances, items, categories, fromDate, toDate) {
  const [from, to] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
  const itemsById = new Map(items.map((i) => [i.id, i]))
  const categoriesById = new Map(categories.map((c) => [c.id, c]))

  const minutesByCategory = new Map()

  for (const inst of instances) {
    if (!inst.finalized) continue
    if (inst.status !== 'completed' && inst.status !== 'worked_on') continue
    if (inst.date < from || inst.date > to) continue
    if (inst.durationMinutes == null) continue

    const pct =
      inst.status === 'completed'
        ? 100
        : Math.max(0, Math.min(100, inst.finalPercent ?? inst.percentComplete ?? 100))
    const minutes = (inst.durationMinutes * pct) / 100

    const item = itemsById.get(inst.itemId)
    const category = item?.categoryId ? categoriesById.get(item.categoryId) : null
    const key = category?.id ?? null
    minutesByCategory.set(key, (minutesByCategory.get(key) ?? 0) + minutes)
  }

  const rows = Array.from(minutesByCategory.entries())
    .map(([categoryId, minutes]) => {
      const category = categoryId ? categoriesById.get(categoryId) : null
      return {
        categoryId,
        name: category?.name ?? UNCATEGORIZED.name,
        color: category?.color ?? UNCATEGORIZED.color,
        minutes: Math.round(minutes),
      }
    })
    .filter((r) => r.minutes > 0)
    .sort((a, b) => b.minutes - a.minutes)

  const totalMinutes = rows.reduce((sum, r) => sum + r.minutes, 0)
  return { rows, totalMinutes }
}

/**
 * Screen-time summary over a date range, from the per-day `screenTimeMinutes`
 * logged on journal entries. Days with no value logged are kept in `days`
 * (minutes: null) so a strip can show the gaps, but don't count toward the
 * average.
 *
 * @param {import('../data/types.js').DayJournal[]} journals
 * @param {string} fromDate 'YYYY-MM-DD' inclusive
 * @param {string} toDate 'YYYY-MM-DD' inclusive
 * @returns {{ days: {date: string, minutes: number|null}[], loggedDays: number, totalMinutes: number, avgMinutes: number, maxMinutes: number }}
 */
export function computeScreenTimeStats(journals, fromDate, toDate) {
  const [from, to] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
  const byDate = new Map(
    journals
      .filter((j) => j.screenTimeMinutes != null && j.date >= from && j.date <= to)
      .map((j) => [j.date, j.screenTimeMinutes])
  )

  const days = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    days.push({ date: d, minutes: byDate.has(d) ? byDate.get(d) : null })
    // Guard against a pathological range blowing the loop up.
    if (days.length > 1000) break
  }

  const logged = days.filter((d) => d.minutes != null)
  const totalMinutes = logged.reduce((sum, d) => sum + d.minutes, 0)
  const loggedDays = logged.length
  const avgMinutes = loggedDays === 0 ? 0 : Math.round(totalMinutes / loggedDays)
  const maxMinutes = logged.reduce((max, d) => Math.max(max, d.minutes), 0)

  return { days, loggedDays, totalMinutes, avgMinutes, maxMinutes }
}

const SLEEP_CATEGORY_NAME = 'Sleep'

/**
 * "Down time" over a range: waking minutes that weren't covered by a
 * completed/worked-on task.
 *   waking   = 24h/day  −  scheduled Sleep time
 *   downtime = waking    −  completed/worked task time (Sleep excluded)
 * Also returns the range's total logged screen time for display alongside.
 *
 * @param {import('../data/types.js').ScheduledInstance[]} instances
 * @param {import('../data/types.js').Item[]} items
 * @param {import('../data/types.js').Category[]} categories
 * @param {import('../data/types.js').DayJournal[]} journals
 * @param {string} fromDate 'YYYY-MM-DD' inclusive
 * @param {string} toDate 'YYYY-MM-DD' inclusive
 */
export function computeUnscheduledTime(instances, items, categories, journals, fromDate, toDate) {
  const [from, to] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]

  let dayCount = 0
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    dayCount++
    if (dayCount > 5000) break
  }
  const totalMinutes = dayCount * 1440

  const itemsById = new Map(items.map((i) => [i.id, i]))
  const sleepCategoryIds = new Set(
    categories.filter((c) => c.name === SLEEP_CATEGORY_NAME).map((c) => c.id)
  )
  const isSleepInstance = (inst) => {
    const item = itemsById.get(inst.itemId)
    return Boolean(item?.categoryId && sleepCategoryIds.has(item.categoryId))
  }

  let sleepMinutes = 0
  for (const inst of instances) {
    if (inst.isAllDay || inst.durationMinutes == null) continue
    if (inst.date < from || inst.date > to) continue
    if (isSleepInstance(inst)) sleepMinutes += inst.durationMinutes
  }
  const wakingMinutes = Math.max(0, totalMinutes - sleepMinutes)

  const { rows } = computeCategoryTime(instances, items, categories, from, to)
  // Sleep isn't part of waking time, so it's left out of the per-category rows.
  const taskRows = rows.filter((r) => !r.categoryId || !sleepCategoryIds.has(r.categoryId))
  const completedTaskMinutes = taskRows.reduce((sum, r) => sum + r.minutes, 0)

  const downtimeMinutes = Math.max(0, wakingMinutes - completedTaskMinutes)

  const screenTimeMinutes = journals
    .filter((j) => j.screenTimeMinutes != null && j.date >= from && j.date <= to)
    .reduce((sum, j) => sum + j.screenTimeMinutes, 0)

  return { downtimeMinutes, wakingMinutes, sleepMinutes, completedTaskMinutes, screenTimeMinutes, taskRows }
}
