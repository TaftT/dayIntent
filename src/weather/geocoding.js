import { roundCoord } from './weatherSettings.js'

// Place-name search (city -> coordinates), kept separate from the forecast
// providers so either can be swapped on its own. Uses Open-Meteo's free,
// keyless geocoding endpoint; note its free tier is for non-commercial use.

const SEARCH_URL = 'https://geocoding-api.open-meteo.com/v1/search'

/** @returns {Promise<{label: string, lat: number, lon: number}[]>} */
export async function searchPlaces(query, signal) {
  const name = query.trim()
  if (name.length < 2) return []
  const res = await fetch(`${SEARCH_URL}?name=${encodeURIComponent(name)}&count=6&language=en&format=json`, { signal })
  if (!res.ok) throw new Error(`Place search failed (${res.status})`)
  const data = await res.json()
  return (data.results ?? []).map((r) => ({
    label: [r.name, r.admin1, r.country_code].filter(Boolean).join(', '),
    lat: roundCoord(r.latitude),
    lon: roundCoord(r.longitude),
  }))
}
