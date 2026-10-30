import { WeatherError } from '../errors.js'

// National Weather Service (api.weather.gov). Free, no API key, US locations
// only, hourly forecast for roughly the next 6.5 days plus the past week of
// station observations. US government data, so there are no commercial-use
// restrictions. It asks clients to identify themselves with a User-Agent, but
// browsers don't let pages set that header, so we just don't send one.

const BASE = 'https://api.weather.gov'

/** Map NWS' free-text description ("Chance Rain Showers") to a condition. */
export function conditionFromNwsText(text = '') {
  const t = text.toLowerCase()
  if (/thunder/.test(t)) return 'thunder'
  if (/freezing|sleet|ice pellets|wintry/.test(t)) return 'sleet'
  if (/snow|flurr|blizzard/.test(t)) return 'snow'
  if (/drizzle/.test(t)) return 'drizzle'
  if (/rain|shower/.test(t)) return 'rain'
  if (/fog|haze|smoke|mist/.test(t)) return 'fog'
  if (/partly|mostly cloudy|becoming cloudy/.test(t)) return /partly/.test(t) ? 'partly-cloudy' : 'cloudy'
  if (/cloudy|overcast/.test(t)) return 'cloudy'
  if (/mostly (sunny|clear)/.test(t)) return 'mostly-clear'
  if (/sunny|clear|fair/.test(t)) return 'clear'
  if (/wind|breezy/.test(t)) return 'wind'
  return 'cloudy'
}

async function getJson(url, signal) {
  let res
  try {
    res = await fetch(url, { signal, headers: { Accept: 'application/geo+json' } })
  } catch (e) {
    if (e?.name === 'AbortError') throw e
    throw new WeatherError('network', 'Couldn’t reach the National Weather Service.')
  }
  if (res.status === 404) {
    throw new WeatherError('unsupported-location', 'The National Weather Service only covers US locations.')
  }
  if (!res.ok) throw new WeatherError('http', `Weather service error (${res.status}).`)
  return res.json()
}

// The /points lookup (lat/lon -> forecast URL, stations, timezone) never
// changes for a location, so remember it for the session.
const pointCache = new Map()

async function pointFor(lat, lon, signal) {
  const key = `${lat},${lon}`
  if (!pointCache.has(key)) {
    const point = await getJson(`${BASE}/points/${lat},${lon}`, signal)
    const p = point?.properties
    if (!p?.forecastHourly) throw new WeatherError('unsupported-location', 'No forecast is available for that location.')
    pointCache.set(key, { hourlyUrl: p.forecastHourly, stationsUrl: p.observationStations, timeZone: p.timeZone })
  }
  return pointCache.get(key)
}

/** Location-local 'YYYY-MM-DDTHH' for an instant, in the given IANA timezone. */
export function hourKeyInZone(isoTime, timeZone) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(new Date(isoTime))
  const get = (type) => parts.find((x) => x.type === type).value
  return `${get('year')}-${get('month')}-${get('day')}T${get('hour')}`
}

export const nws = {
  id: 'nws',
  name: 'National Weather Service (US)',
  coverage: 'US only',
  maxDays: 7,

  /**
   * @returns {Promise<import('../types.js').HourlyForecast[]>}
   */
  async fetchHourly({ lat, lon, signal }) {
    const { hourlyUrl } = await pointFor(lat, lon, signal)
    const data = await getJson(hourlyUrl, signal)
    const periods = data?.properties?.periods ?? []
    return periods.map((p) => ({
      // Keep the location-local wall-clock time ("2026-10-30T14") — that's
      // what lines up with the user's hour rows, whatever timezone the
      // device is in.
      hourKey: p.startTime.slice(0, 13),
      condition: conditionFromNwsText(p.shortForecast),
      isDaytime: Boolean(p.isDaytime),
      tempF: p.temperatureUnit === 'C' ? Math.round((p.temperature * 9) / 5 + 32) : p.temperature,
      precipChance: p.probabilityOfPrecipitation?.value ?? null,
      summary: p.shortForecast ?? '',
    }))
  },

  /**
   * What the weather actually was: the nearest station's recent observations
   * (about the past week), reduced to one entry per hour.
   * @returns {Promise<import('../types.js').HourlyForecast[]>}
   */
  async fetchObserved({ lat, lon, signal }) {
    const { stationsUrl, timeZone } = await pointFor(lat, lon, signal)
    if (!stationsUrl || !timeZone) return []
    const stations = await getJson(stationsUrl, signal)
    const stationId = stations?.features?.[0]?.properties?.stationIdentifier
    if (!stationId) return []
    const data = await getJson(`${BASE}/stations/${stationId}/observations?limit=200`, signal)
    const byHour = new Map()
    for (const f of data?.features ?? []) {
      const o = f.properties
      if (!o?.timestamp || !o.textDescription) continue
      const hourKey = hourKeyInZone(o.timestamp, timeZone)
      // Keep the observation closest to the top of the hour.
      const minutes = new Date(o.timestamp).getUTCMinutes()
      if (byHour.has(hourKey) && byHour.get(hourKey).minutes <= minutes) continue
      const c = o.temperature?.value
      byHour.set(hourKey, {
        minutes,
        entry: {
          hourKey,
          condition: conditionFromNwsText(o.textDescription),
          isDaytime: !/\/night\//.test(o.icon ?? ''),
          tempF: c == null ? null : Math.round((c * 9) / 5 + 32),
          precipChance: null, // an observation is what happened, not a chance
          summary: o.textDescription,
        },
      })
    }
    return [...byHour.values()].map((v) => v.entry)
  },
}
