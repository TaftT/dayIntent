import { useEffect, useMemo } from 'react'
import { useWeatherStore } from '../store/useWeatherStore.js'
import { locKey } from '../weather/weatherSettings.js'
import { addDaysStr, todayStr } from '../utils/dateUtils.js'

// Days this far from today are worth fetching a forecast for; further out
// there's no forecast yet, and further back only saved history applies.
const FETCH_WINDOW_DAYS = 8

/**
 * Weather for one day as a Map of hour (0-23) -> entry. Upcoming hours come
 * from the forecast; hours that already passed come from the saved history
 * (marked `observed: true`). Each hour uses its event's location when it has
 * one (`place` is then set to that location's label), else the home location.
 *
 * @param {string} date
 * @param {({lat: number, lon: number, label: string}|null)[]} [eventLocations] 24 entries from hourLocationsForDay
 */
export function useHourlyWeather(date, eventLocations = []) {
  const enabled = useWeatherStore((s) => s.settings.enabled)
  const home = useWeatherStore((s) => s.settings.location)
  const forecasts = useWeatherStore((s) => s.forecasts)
  const history = useWeatherStore((s) => s.history)
  const ensureFresh = useWeatherStore((s) => s.ensureFresh)
  const reloadHistory = useWeatherStore((s) => s.reloadHistory)

  // Recorded weather lives in the local database; load it once weather is on.
  useEffect(() => {
    if (enabled) reloadHistory()
  }, [enabled, reloadHistory])

  // Distinct places this day needs, by key.
  const places = useMemo(() => {
    const byKey = new Map()
    for (let h = 0; h < 24; h++) {
      const loc = eventLocations[h] ?? home
      if (loc) byKey.set(locKey(loc), loc)
    }
    return byKey
  }, [eventLocations, home])
  const placesSignature = [...places.keys()].join('|')

  useEffect(() => {
    if (!enabled) return
    const today = todayStr()
    if (date < addDaysStr(today, -FETCH_WINDOW_DAYS) || date > addDaysStr(today, FETCH_WINDOW_DAYS)) return
    for (const loc of places.values()) ensureFresh(loc)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, date, placesSignature, ensureFresh])

  return useMemo(() => {
    const byHour = new Map()
    if (!enabled) return byHour
    for (let h = 0; h < 24; h++) {
      const eventLoc = eventLocations[h]
      const loc = eventLoc ?? home
      if (!loc) continue
      const key = locKey(loc)
      const place = eventLoc ? eventLoc.label || 'Event location' : null
      const hourKey = `${date}T${String(h).padStart(2, '0')}`
      const [condition, day, tempF] = history[key]?.[hourKey] ?? []
      if (condition) byHour.set(h, { hourKey, condition, isDaytime: day === 1, tempF, precipChance: null, observed: true, place })
      // The forecast wins for any hour it covers.
      const forecast = forecasts[key]?.hours.find((f) => f.hourKey === hourKey)
      if (forecast) byHour.set(h, { ...forecast, place })
    }
    return byHour
  }, [enabled, home, forecasts, history, date, eventLocations])
}
