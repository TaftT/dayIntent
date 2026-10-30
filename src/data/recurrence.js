import { addDays, addMonths, differenceInCalendarDays, getDay, getDate } from 'date-fns'
import { fromDateStr, toDateStr } from '../utils/dateUtils.js'
import { generateId } from './idGenerator.js'
import * as repo from './index.js'

// Occurrences are only materialised this far ahead of today (a rolling window),
// so a long-running or endless series never piles up instances. The window is
// topped up by topUpRecurringInstances as time passes.
export const GENERATION_HORIZON_DAYS = 60

/**
 * Returns the list of occurrence date strings ('YYYY-MM-DD') for a recurrence
 * rule that fall within [rangeStart, rangeEnd] (inclusive), also respecting
 * the rule's own startDate/endDate bounds.
 * @param {import('./types.js').RecurrenceRule} rule
 * @param {string} rangeStart
 * @param {string} rangeEnd
 * @returns {string[]}
 */
export function getOccurrencesBetween(rule, rangeStart, rangeEnd) {
  const effectiveStart = rule.startDate > rangeStart ? rule.startDate : rangeStart
  const effectiveEnd = rule.endDate && rule.endDate < rangeEnd ? rule.endDate : rangeEnd
  if (effectiveStart > effectiveEnd) return []

  const interval = Math.max(1, rule.interval || 1)
  const ruleStart = fromDateStr(rule.startDate)
  const results = []

  if (rule.freq === 'daily' || rule.freq === 'everyN') {
    let cursor = fromDateStr(effectiveStart)
    // align cursor to a valid multiple-of-interval offset from ruleStart
    const offset = differenceInCalendarDays(cursor, ruleStart) % interval
    if (offset !== 0) cursor = addDays(cursor, interval - offset)
    while (toDateStr(cursor) <= effectiveEnd) {
      results.push(toDateStr(cursor))
      cursor = addDays(cursor, interval)
    }
  } else if (rule.freq === 'weekly') {
    const weekdays =
      rule.byWeekday && rule.byWeekday.length > 0 ? rule.byWeekday : [getDay(ruleStart)]
    const ruleWeekStart = addDays(ruleStart, -getDay(ruleStart))
    let cursor = fromDateStr(effectiveStart)
    const rangeEndDate = fromDateStr(effectiveEnd)
    while (cursor <= rangeEndDate) {
      const dateStr = toDateStr(cursor)
      if (dateStr >= rule.startDate && weekdays.includes(getDay(cursor))) {
        const cursorWeekStart = addDays(cursor, -getDay(cursor))
        const weekDiff = Math.round(differenceInCalendarDays(cursorWeekStart, ruleWeekStart) / 7)
        if (weekDiff % interval === 0) results.push(dateStr)
      }
      cursor = addDays(cursor, 1)
    }
  } else if (rule.freq === 'monthly') {
    const targetDay = getDate(ruleStart)
    let cursor = ruleStart
    while (toDateStr(cursor) <= effectiveEnd) {
      const dateStr = toDateStr(cursor)
      if (dateStr >= effectiveStart && dateStr <= effectiveEnd && getDate(cursor) === targetDay) {
        results.push(dateStr)
      }
      cursor = addMonths(cursor, interval)
    }
  }

  return results
}

function buildInstance(item, date, id = generateId()) {
  const now = new Date().toISOString()
  return {
    id,
    itemId: item.id,
    date,
    time: item.recurrence.time,
    durationMinutes: item.durationMinutes,
    isAllDay: !item.recurrence.time,
    notes: item.notes, // seeded from the template, then independent per occurrence from here on
    percentComplete: 0, // every occurrence of a series starts fresh, independent of the others
    startPercent: 0, // baseline for "did you do any work this day" — every occurrence starts at 0
    status: 'pending',
    finalized: false,
    finalPercent: null,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Ensures ScheduledInstances exist for an item's recurrence out to a horizon
 * (today + 60 days by default). Safe to call repeatedly (idempotent) — will
 * only create instances for dates that don't already have one for this item.
 * @param {import('./types.js').Item} item
 * @param {string} today
 * @param {number} [horizonDays]
 */
export async function ensureInstancesGenerated(item, today, horizonDays = GENERATION_HORIZON_DAYS) {
  if (!item.recurrence) return

  const horizonEnd = toDateStr(addDays(fromDateStr(today), horizonDays))
  const rangeStart = item.recurrence.startDate < today ? item.recurrence.startDate : today
  const occurrenceDates = getOccurrencesBetween(item.recurrence, rangeStart, horizonEnd)

  const existing = await repo.getInstancesForItem(item.id)
  const existingDates = new Set(existing.map((inst) => inst.date))

  const toCreate = occurrenceDates
    .filter((date) => !existingDates.has(date))
    .map((date) => buildInstance(item, date))

  if (toCreate.length > 0) {
    await repo.bulkSaveInstances(toCreate)
  }
}

/**
 * Keeps every recurring series generating as time passes. Ensures occurrences
 * exist out to today + horizonDays, but only *beyond* what the series already
 * has: a series' "frontier" is its latest instance inside the window, and new
 * occurrences start the day after it (never earlier than today). That makes
 * this safe to run on every app start / day change / sync because it can't
 * bring back an occurrence the user deleted or moved earlier in the window,
 * and it doesn't invent a backlog of missed past days for a series that went
 * quiet.
 *
 * Ids are deterministic (item + date) so two devices topping up the same
 * series before they've synced produce the same records instead of duplicates.
 * (Edits still regenerate with random ids via ensureInstancesGenerated.)
 *
 * @param {import('./types.js').Item[]} items
 * @param {string} today 'YYYY-MM-DD'
 * @returns {Promise<number>} how many instances were created
 */
export async function topUpRecurringInstances(items, today, horizonDays = GENERATION_HORIZON_DAYS) {
  const horizonEnd = toDateStr(addDays(fromDateStr(today), horizonDays))
  const byItem = new Map()
  for (const inst of await repo.getAllInstances()) {
    if (!byItem.has(inst.itemId)) byItem.set(inst.itemId, [])
    byItem.get(inst.itemId).push(inst)
  }

  const toCreate = []
  for (const item of items) {
    if (!item.recurrence || item.archived) continue
    const own = byItem.get(item.id) ?? []
    // Anything beyond today's window (e.g. one dragged months ahead) doesn't count as the frontier.
    const frontier = own.map((i) => i.date).filter((d) => d <= horizonEnd).sort().pop() ?? null
    const fromDate = frontier ? toDateStr(addDays(fromDateStr(frontier), 1)) : item.recurrence.startDate
    const start = fromDate > today ? fromDate : today
    const have = new Set(own.map((i) => i.date))
    for (const date of getOccurrencesBetween(item.recurrence, start, horizonEnd)) {
      if (!have.has(date)) toCreate.push(buildInstance(item, date, `${item.id}_${date}`))
    }
  }
  if (toCreate.length > 0) await repo.bulkSaveInstances(toCreate)
  return toCreate.length
}

/**
 * Deletes all non-finalized instances for an item and regenerates them from
 * its current recurrence rule. Used when a recurring item's template is
 * edited — past finalized instances are left untouched.
 * @param {import('./types.js').Item} item
 * @param {string} today
 */
export async function regenerateFutureInstances(item, today) {
  const existing = await repo.getInstancesForItem(item.id)
  const nonFinalized = existing.filter((inst) => !inst.finalized)
  for (const inst of nonFinalized) {
    await repo.deleteInstance(inst.id)
  }
  if (item.recurrence) {
    await ensureInstancesGenerated(item, today)
    // A lock and a move history belong to the occurrence on that day, so they
    // survive the regeneration rather than being silently reset by a series edit.
    const kept = new Map(
      nonFinalized.filter((i) => i.locked || i.moves?.length).map((i) => [i.date, { locked: i.locked, moves: i.moves }]),
    )
    if (kept.size > 0) {
      for (const inst of await repo.getInstancesForItem(item.id)) {
        const carry = kept.get(inst.date)
        if (carry && !inst.finalized) await repo.saveInstance({ ...inst, ...carry })
      }
    }
  }
}
