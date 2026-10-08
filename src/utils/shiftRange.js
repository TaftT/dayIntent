import { differenceInCalendarDays } from 'date-fns'
import { addDaysStr, fromDateStr, todayStr, currentWeekRange } from './dateUtils.js'

const lengthInDays = ({ from, to }) => differenceInCalendarDays(fromDateStr(to), fromDateStr(from)) + 1

/**
 * Steps a stats date range one "page" back (-1) or forward (+1): a 1-day
 * range moves a day, a 7-day range a week, a 30-day range 30 days, and so on.
 * The in-progress week (Sunday through today) steps back to the previous
 * *full* week. Going forward never passes today, and there is nothing past it.
 *
 * @returns {{from: string, to: string}|null} null when it can't move that way
 */
export function shiftRange(range, direction, today = todayStr()) {
  const week = currentWeekRange(fromDateStr(today))
  const weekToDate = range.from === week.from && range.to === today

  if (direction < 0) {
    if (weekToDate) return { from: addDaysStr(range.from, -7), to: addDaysStr(range.from, -1) }
    const n = lengthInDays(range)
    return { from: addDaysStr(range.from, -n), to: addDaysStr(range.to, -n) }
  }

  if (range.to >= today) return null
  const n = lengthInDays(range)
  const to = addDaysStr(range.to, n)
  return { from: addDaysStr(range.from, n), to: to > today ? today : to }
}
