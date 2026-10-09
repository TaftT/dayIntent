import { addDays, addMonths, differenceInCalendarDays, getDay, getDate } from 'date-fns'
import { fromDateStr, toDateStr } from '../utils/dateUtils.js'
import { generateId } from './idGenerator.js'
import * as repo from './index.js'

const GENERATION_HORIZON_DAYS = 60

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
    .map((date) => ({
      id: generateId(),
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
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }))

  if (toCreate.length > 0) {
    await repo.bulkSaveInstances(toCreate)
  }
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
  }
}
