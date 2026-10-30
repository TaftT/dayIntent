import { DEFAULT_PROVIDER_ID, providers } from './providers/index.js'

// Weather is opt-in and device-local: the location is never synced or sent
// anywhere except the chosen weather provider.

const SETTINGS_KEY = 'dayintent.weather'
const CACHE_KEY = 'dayintent.weather.cache'

export const DEFAULT_WEATHER_SETTINGS = {
  enabled: false,
  providerId: DEFAULT_PROVIDER_ID,
  location: null, // { lat, lon, label }
  syncHistory: false, // sync recorded weather to the signed-in account
}

/** Coordinates rounded to ~1 km — plenty for a forecast, and less precise to hand over. */
export const roundCoord = (n) => Math.round(n * 100) / 100

export function loadWeatherSettings() {
  try {
    const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY))
    const loc = saved?.location
    const validLoc =
      loc && Number.isFinite(loc.lat) && Number.isFinite(loc.lon)
        ? { lat: roundCoord(loc.lat), lon: roundCoord(loc.lon), label: String(loc.label ?? '') }
        : null
    return {
      enabled: Boolean(saved?.enabled),
      providerId: providers[saved?.providerId] ? saved.providerId : DEFAULT_PROVIDER_ID,
      location: validLoc,
      syncHistory: Boolean(saved?.syncHistory),
    }
  } catch {
    return { ...DEFAULT_WEATHER_SETTINGS }
  }
}

export function saveWeatherSettings(settings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings))
  } catch {
    /* private mode etc. — the change just won't persist */
  }
}

/** Where weather is looked up: the home location, or an event's own location. */
export const locKey = (loc) => `${loc.lat},${loc.lon}`

const MAX_CACHED_LOCATIONS = 8

/**
 * The last forecasts we fetched, as { [locKey]: { providerId, fetchedAt, hours } },
 * so a reload (or going offline) still shows something.
 */
export function loadForecastCache() {
  try {
    const c = JSON.parse(localStorage.getItem(CACHE_KEY))
    return c && typeof c === 'object' && !Array.isArray(c) ? c : {}
  } catch {
    return {}
  }
}

export function saveForecastCache(cache) {
  // Keep only the most recently fetched few so trips don't pile up forever.
  const newest = Object.entries(cache)
    .sort((a, b) => b[1].fetchedAt - a[1].fetchedAt)
    .slice(0, MAX_CACHED_LOCATIONS)
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(Object.fromEntries(newest)))
  } catch {
    /* ignore */
  }
}

export function clearForecastCache() {
  try {
    localStorage.removeItem(CACHE_KEY)
  } catch {
    /* ignore */
  }
}
