import { create } from 'zustand'
import * as repo from '../data/index.js'
import * as syncEngine from '../sync/syncEngine.js'
import { applyObserved, daysToHistoryMap } from '../weather/historyDays.js'
import { addDaysStr, todayStr } from '../utils/dateUtils.js'
import { getProvider } from '../weather/providers/index.js'
import { WeatherError } from '../weather/errors.js'
import {
  clearForecastCache,
  loadForecastCache,
  loadWeatherSettings,
  locKey,
  saveForecastCache,
  saveWeatherSettings,
} from '../weather/weatherSettings.js'

// How long a fetched forecast is reused before asking the provider again.
export const FORECAST_TTL_MS = 30 * 60 * 1000

// Weather is purely a display extra: failures only set `errors[key]` here and
// are never thrown into the rest of the app.
//
// Everything is keyed by location (`locKey`): the home location plus any
// event locations whose days have been viewed.

const inFlight = new Map() // locKey -> Promise

// Recorded days older than this are dropped from the device.
const HISTORY_KEEP_DAYS = 400

function initialState() {
  const settings = loadWeatherSettings()
  const cached = loadForecastCache()
  const forecasts = {}
  for (const [key, c] of Object.entries(cached)) {
    if (c?.providerId === settings.providerId && Array.isArray(c.hours)) forecasts[key] = c
  }
  return {
    settings,
    forecasts, // { [locKey]: { providerId, fetchedAt, hours } }
    history: {}, // { [locKey]: { hourKey: [condition, isDaytime, tempF] } } for hours already past; mirrors the weatherDays store (see reloadHistory)
    status: {}, // { [locKey]: 'loading' | 'ready' | 'error' }
    errors: {}, // { [locKey]: message }
  }
}

const setKey = (obj, key, value) => ({ ...obj, [key]: value })

export const useWeatherStore = create((set, get) => ({
  ...initialState(),

  /** Merge changes into the settings and persist them. Switching service drops the old service's data. */
  updateSettings: (patch) => {
    const prev = get().settings
    const settings = { ...prev, ...patch }
    saveWeatherSettings(settings)
    if (prev.syncHistory !== settings.syncHistory) syncEngine.setWeatherSync(settings.syncHistory).catch(() => {})
    if (prev.providerId !== settings.providerId) {
      clearForecastCache()
      inFlight.clear()
      set({ settings, forecasts: {}, status: {}, errors: {} })
    } else {
      set({ settings })
    }
    if (settings.location) get().ensureFresh(settings.location)
  },

  /** Fetch a location's forecast only when enabled and the data is missing or stale. */
  ensureFresh: (loc) => {
    const { settings, forecasts, status } = get()
    if (!settings.enabled || !loc) return Promise.resolve()
    const key = locKey(loc)
    if (status[key] === 'loading') return Promise.resolve()
    const fetchedAt = forecasts[key]?.fetchedAt
    if (fetchedAt && Date.now() - fetchedAt < FORECAST_TTL_MS) return Promise.resolve()
    return get().refresh(loc)
  },

  /** Load the recorded weather from the local database (also called when a sync brings in more). */
  reloadHistory: async () => {
    try {
      set({ history: daysToHistoryMap(await repo.getAllWeatherDays()) })
    } catch {
      /* history is a bonus; leave what's shown */
    }
  },

  /** Save what the weather actually was for recent hours. Best-effort: never fails a refresh. */
  recordObserved: async (provider, loc) => {
    if (!provider.fetchObserved) return
    try {
      const observed = await provider.fetchObserved({ lat: loc.lat, lon: loc.lon })
      if (observed.length === 0) return
      const existing = new Map((await repo.getAllWeatherDays()).map((d) => [d.id, d]))
      for (const day of applyObserved(observed, loc, existing)) await repo.saveWeatherDay(day)
      await repo.pruneWeatherDays(addDaysStr(todayStr(), -HISTORY_KEEP_DAYS))
      await get().reloadHistory()
    } catch {
      /* observations are a bonus; the forecast is already shown */
    }
  },

  refresh: (loc = get().settings.location) => {
    const { settings } = get()
    if (!settings.enabled || !loc) return Promise.resolve()
    const key = locKey(loc)
    if (inFlight.has(key)) return inFlight.get(key)
    const provider = getProvider(settings.providerId)
    set((s) => ({ status: setKey(s.status, key, 'loading'), errors: setKey(s.errors, key, null) }))
    const run = (async () => {
      try {
        const hours = await provider.fetchHourly({ lat: loc.lat, lon: loc.lon })
        // Ignore the result if the user switched service meanwhile.
        if (inFlight.get(key) !== run || get().settings.providerId !== provider.id) return
        const forecasts = setKey(get().forecasts, key, { providerId: provider.id, fetchedAt: Date.now(), hours })
        saveForecastCache(forecasts)
        set((s) => ({ forecasts, status: setKey(s.status, key, 'ready') }))
        await get().recordObserved(provider, loc)
      } catch (e) {
        if (inFlight.get(key) !== run) return
        const message = e instanceof WeatherError ? e.message : 'Couldn’t load the forecast.'
        // Keep showing the last good forecast, if any, alongside the error.
        set((s) => ({ status: setKey(s.status, key, 'error'), errors: setKey(s.errors, key, message) }))
      } finally {
        if (inFlight.get(key) === run) inFlight.delete(key)
      }
    })()
    inFlight.set(key, run)
    return run
  },
}))

/** Test helper: reload settings/cache from storage. */
export function _resetWeatherStoreForTests() {
  inFlight.clear()
  useWeatherStore.setState(initialState())
}
