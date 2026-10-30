import { addDaysStr } from '../utils/dateUtils.js'
import { timeStrToMinutes } from '../utils/dateUtils.js'

// Which place each hour of a day should show weather for. An event with a
// location overrides the home location while it is on: an all-day (or multi-
// day) event for the whole day, a timed event for the hours it covers. Hours
// no event claims are `null`, meaning "use the home location".

const allDaySpan = (instance) => Math.max(1, Math.round((instance.durationMinutes ?? 1440) / 1440))

/**
 * @param {string} date 'YYYY-MM-DD'
 * @param {import('../data/types.js').ScheduledInstance[]} dayInstances instances scheduled on `date`
 * @param {import('../data/types.js').ScheduledInstance[]} allInstances every instance (for multi-day events that started earlier)
 * @param {import('../data/types.js').Item[]} items
 * @returns {({lat: number, lon: number, label: string}|null)[]} 24 entries
 */
export function hourLocationsForDay(date, dayInstances, allInstances, items) {
  const locationOf = (instance) => items.find((i) => i.id === instance.itemId)?.location ?? null
  const result = Array(24).fill(null)

  // All-day events covering today, including multi-day ones that began earlier.
  // If several have a location, the one that started most recently wins.
  const allDay = [
    ...dayInstances.filter((i) => i.isAllDay),
    ...allInstances.filter(
      (i) => i.isAllDay && i.date < date && addDaysStr(i.date, allDaySpan(i)) > date && !dayInstances.some((d) => d.id === i.id),
    ),
  ]
    .filter((i) => locationOf(i))
    .sort((a, b) => b.date.localeCompare(a.date))
  if (allDay.length > 0) result.fill(locationOf(allDay[0]))

  // Timed events claim the hours they overlap, later starts winning.
  const timed = dayInstances
    .filter((i) => !i.isAllDay && i.time && i.durationMinutes != null && locationOf(i))
    .sort((a, b) => a.time.localeCompare(b.time))
  for (const i of timed) {
    const start = timeStrToMinutes(i.time)
    const end = start + i.durationMinutes
    for (let h = 0; h < 24; h++) {
      if (h * 60 < end && (h + 1) * 60 > start) result[h] = locationOf(i)
    }
  }
  return result
}
