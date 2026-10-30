import { locKey } from './weatherSettings.js'

// Recorded weather is stored one record per (day, place):
//   { id, date, lat, lon, label, hours: { '14': [condition, isDaytime 1/0, tempF] }, updatedAt }
// Hours only ever accumulate (they are facts about the past), so two devices
// that each recorded different hours of the same day merge as a union rather
// than one overwriting the other.

/** Firebase-safe id (no dots) for a day at a place. */
export const dayId = (date, loc) => `${date}_${Math.round(loc.lat * 100)}_${Math.round(loc.lon * 100)}`

/** Union of two days' hours; `b` wins an hour both have. */
export function unionHours(a = {}, b = {}) {
  return { ...a, ...b }
}

const sameTuple = (x, y) => x && y && x[0] === y[0] && x[1] === y[1] && x[2] === y[2]

/** Whether `hours` has any hour that `other` lacks or has different. */
export function hasExtraHours(hours = {}, other = {}) {
  return Object.keys(hours).some((h) => !sameTuple(hours[h], other[h]))
}

/** Fold observed hours (from a provider) into per-day records, merging with `existingById`. Returns only the records that changed. */
export function applyObserved(observed, loc, existingById) {
  const byDate = new Map()
  for (const o of observed) {
    const date = o.hourKey.slice(0, 10)
    if (!byDate.has(date)) byDate.set(date, {})
    byDate.get(date)[o.hourKey.slice(11, 13)] = [o.condition, o.isDaytime ? 1 : 0, o.tempF]
  }
  const changed = []
  for (const [date, hours] of byDate) {
    const id = dayId(date, loc)
    const existing = existingById.get(id)
    if (existing && !hasExtraHours(hours, existing.hours)) continue
    changed.push({
      id,
      date,
      lat: loc.lat,
      lon: loc.lon,
      label: existing?.label || loc.label || '',
      hours: unionHours(existing?.hours, hours),
    })
  }
  return changed
}

/** { [locKey]: { 'YYYY-MM-DDTHH': tuple } } for the hooks to look hours up quickly. */
export function daysToHistoryMap(days) {
  const map = {}
  for (const day of days) {
    const key = locKey(day)
    const forLoc = (map[key] ??= {})
    for (const [hh, tuple] of Object.entries(day.hours ?? {})) forLoc[`${day.date}T${hh}`] = tuple
  }
  return map
}
