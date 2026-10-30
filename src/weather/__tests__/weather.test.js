import { describe, it, expect, beforeEach, vi } from 'vitest'
import { conditionFromNwsText, hourKeyInZone, nws } from '../providers/nws.js'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { applyObserved, dayId, daysToHistoryMap, hasExtraHours, unionHours } from '../historyDays.js'
import { hourLocationsForDay } from '../hourLocations.js'
import { conditionIcon } from '../conditions.js'
import { useWeatherStore, _resetWeatherStoreForTests } from '../../store/useWeatherStore.js'

describe('NWS condition mapping', () => {
  it.each([
    ['Mostly Sunny', 'mostly-clear'],
    ['Sunny', 'clear'],
    ['Partly Cloudy', 'partly-cloudy'],
    ['Mostly Cloudy', 'cloudy'],
    ['Chance Rain Showers', 'rain'],
    ['Slight Chance Light Drizzle', 'drizzle'],
    ['Showers And Thunderstorms Likely', 'thunder'],
    ['Light Snow', 'snow'],
    ['Freezing Rain', 'sleet'],
    ['Patchy Fog', 'fog'],
    ['Something Odd', 'cloudy'],
  ])('%s -> %s', (text, expected) => {
    expect(conditionFromNwsText(text)).toBe(expected)
  })

  it('shows a moon for clear nights', () => {
    expect(conditionIcon('clear', false)).toBe('🌙')
  })
})

function mockNws(periods) {
  globalThis.fetch = vi.fn(async (url) => {
    if (url.includes('/points/')) {
      return { ok: true, status: 200, json: async () => ({ properties: { forecastHourly: 'https://api.weather.gov/gridpoints/X/1,1/forecast/hourly' } }) }
    }
    return { ok: true, status: 200, json: async () => ({ properties: { periods } }) }
  })
}

const period = (startTime, over = {}) => ({
  startTime,
  isDaytime: true,
  temperature: 70,
  temperatureUnit: 'F',
  shortForecast: 'Sunny',
  probabilityOfPrecipitation: { value: 20 },
  ...over,
})

describe('NWS provider', () => {
  it('normalizes hourly periods to location-local hour keys', async () => {
    mockNws([period('2099-01-05T14:00:00-05:00'), period('2099-01-05T15:00:00-05:00', { temperature: 20, temperatureUnit: 'C', shortForecast: 'Rain' })])
    const hours = await nws.fetchHourly({ lat: 40.71, lon: -74.01 })
    expect(hours[0]).toMatchObject({ hourKey: '2099-01-05T14', condition: 'clear', tempF: 70, precipChance: 20 })
    expect(hours[1]).toMatchObject({ hourKey: '2099-01-05T15', condition: 'rain', tempF: 68 })
  })

  it('explains when the location is outside the US', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}) }))
    await expect(nws.fetchHourly({ lat: 1.23, lon: 4.56 })).rejects.toMatchObject({ code: 'unsupported-location' })
  })
})

function freshDb() {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  localStorage.clear()
  _resetWeatherStoreForTests()
}

describe('weather store', () => {
  const HOME = { lat: 40.71, lon: -74.01, label: 'x' }
  const VEGAS = { lat: 36.17, lon: -115.14, label: 'Las Vegas' }
  const s = () => useWeatherStore.getState()
  const key = (l) => `${l.lat},${l.lon}`

  beforeEach(freshDb)

  it('does nothing until enabled with a location', async () => {
    mockNws([])
    await s().ensureFresh(HOME)
    expect(globalThis.fetch).not.toHaveBeenCalled()
  })

  it('fetches, caches for the TTL, and keeps each location separately', async () => {
    mockNws([period('2099-01-05T14:00:00-05:00')])
    s().updateSettings({ enabled: true, location: HOME })
    await vi.waitFor(() => expect(s().status[key(HOME)]).toBe('ready'))
    expect(s().forecasts[key(HOME)].hours).toHaveLength(1)

    const calls = globalThis.fetch.mock.calls.length
    await s().ensureFresh(HOME)
    expect(globalThis.fetch.mock.calls.length).toBe(calls) // fresh, no new request

    await s().ensureFresh(VEGAS) // an event location is fetched on its own
    expect(s().forecasts[key(VEGAS)].hours).toHaveLength(1)
    expect(s().forecasts[key(HOME)]).toBeTruthy() // home still there
  })

  it('keeps the last forecast and reports an error when a refresh fails', async () => {
    mockNws([period('2099-01-05T14:00:00-05:00')])
    s().updateSettings({ enabled: true, location: HOME })
    await vi.waitFor(() => expect(s().status[key(HOME)]).toBe('ready'))
    globalThis.fetch = vi.fn(async () => {
      throw new TypeError('offline')
    })
    await s().refresh(HOME)
    expect(s().status[key(HOME)]).toBe('error')
    expect(s().forecasts[key(HOME)].hours).toHaveLength(1)
  })
})

describe('hourLocationsForDay', () => {
  const vegas = { lat: 36.17, lon: -115.14, label: 'Las Vegas' }
  const denver = { lat: 39.74, lon: -104.99, label: 'Denver' }
  const items = [
    { id: 'trip', location: vegas },
    { id: 'meet', location: denver },
    { id: 'plain' },
  ]
  const inst = (id, itemId, date, over = {}) => ({ id, itemId, date, isAllDay: false, time: '09:00', durationMinutes: 60, ...over })

  it('is all home (null) when nothing has a location', () => {
    const r = hourLocationsForDay('2099-01-05', [inst('a', 'plain', '2099-01-05')], [], items)
    expect(r).toHaveLength(24)
    expect(r.every((x) => x === null)).toBe(true)
  })

  it('uses an all-day event’s location for the whole day', () => {
    const day = [inst('t', 'trip', '2099-01-05', { isAllDay: true, time: null, durationMinutes: 1440 })]
    expect(hourLocationsForDay('2099-01-05', day, day, items).every((x) => x === vegas)).toBe(true)
  })

  it('covers later days of a multi-day event', () => {
    const trip = inst('t', 'trip', '2099-01-05', { isAllDay: true, time: null, durationMinutes: 3 * 1440 })
    expect(hourLocationsForDay('2099-01-07', [], [trip], items)[12]).toBe(vegas)
    expect(hourLocationsForDay('2099-01-08', [], [trip], items)[12]).toBe(null)
  })

  it('switches to a timed event’s location only for the hours it covers', () => {
    const day = [inst('m', 'meet', '2099-01-05', { time: '10:30', durationMinutes: 90 })]
    const r = hourLocationsForDay('2099-01-05', day, day, items)
    expect(r.map((x, h) => (x ? h : null)).filter((h) => h !== null)).toEqual([10, 11])
    expect(r[10]).toBe(denver)
  })

  it('lets a timed event override the all-day location', () => {
    const day = [
      inst('t', 'trip', '2099-01-05', { isAllDay: true, time: null, durationMinutes: 1440 }),
      inst('m', 'meet', '2099-01-05', { time: '13:00', durationMinutes: 60 }),
    ]
    const r = hourLocationsForDay('2099-01-05', day, day, items)
    expect(r[12]).toBe(vegas)
    expect(r[13]).toBe(denver)
    expect(r[14]).toBe(vegas)
  })
})

describe('weather history', () => {
  beforeEach(freshDb)

  const home = { lat: 40.73, lon: -74.03, label: 'Home' }
  const obsHour = (hourKey, condition = 'rain', tempF = 50) => ({ hourKey, condition, isDaytime: true, tempF })

  it('converts observation times to the location’s local hour', () => {
    expect(hourKeyInZone('2026-10-30T18:53:00+00:00', 'America/New_York')).toBe('2026-10-30T14')
    expect(hourKeyInZone('2026-10-30T03:10:00+00:00', 'America/Los_Angeles')).toBe('2026-10-29T20')
  })

  it('groups observed hours into one record per day and place, with a sync-safe id', () => {
    const days = applyObserved([obsHour('2026-10-29T14'), obsHour('2026-10-29T15'), obsHour('2026-10-30T01')], home, new Map())
    expect(days.map((d) => d.date)).toEqual(['2026-10-29', '2026-10-30'])
    expect(days[0].id).toBe(dayId('2026-10-29', home))
    expect(days[0].id).not.toMatch(/[.#$/[]]/)
    expect(Object.keys(days[0].hours)).toEqual(['14', '15'])
  })

  it('only reports days that gained something, keeping hours already recorded', () => {
    const existing = new Map([[dayId('2026-10-29', home), { ...applyObserved([obsHour('2026-10-29T14')], home, new Map())[0] }]])
    expect(applyObserved([obsHour('2026-10-29T14')], home, existing)).toEqual([]) // nothing new
    const [grown] = applyObserved([obsHour('2026-10-29T15')], home, existing)
    expect(Object.keys(grown.hours).sort()).toEqual(['14', '15'])
  })

  it('merges two devices’ hours as a union, not one overwriting the other', () => {
    const a = { 14: ['rain', 1, 50] }
    const b = { 15: ['clear', 1, 55] }
    expect(unionHours(a, b)).toEqual({ ...a, ...b })
    expect(hasExtraHours(a, b)).toBe(true)
    expect(hasExtraHours(a, { ...a, ...b })).toBe(false)
  })

  it('builds the lookup the day view uses', () => {
    const [day] = applyObserved([obsHour('2026-10-29T14', 'rain', 50)], home, new Map())
    expect(daysToHistoryMap([day])['40.73,-74.03']['2026-10-29T14']).toEqual(['rain', 1, 50])
  })

  it('records observed hours into the local database and survives a reload', async () => {
    const obs = (timestamp, textDescription, c) => ({ properties: { timestamp, textDescription, temperature: { value: c }, icon: 'https://api.weather.gov/icons/land/day/rain?size=medium' } })
    globalThis.fetch = vi.fn(async (url) => {
      const body = url.includes('/points/')
        ? { properties: { forecastHourly: 'https://x/h', observationStations: 'https://x/s', timeZone: 'America/New_York' } }
        : url.endsWith('/s')
          ? { features: [{ properties: { stationIdentifier: 'KNYC' } }] }
          : url.includes('/observations')
            ? { features: [obs('2026-10-29T18:51:00+00:00', 'Light Rain', 10), obs('2026-10-29T18:15:00+00:00', 'Cloudy', 12)] }
            : { properties: { periods: [] } }
      return { ok: true, status: 200, json: async () => body }
    })
    const s = () => useWeatherStore.getState()
    s().updateSettings({ enabled: true, location: home })
    await vi.waitFor(() => expect(Object.keys(s().history)).toHaveLength(1))
    // the observation nearest the top of the hour wins
    expect(s().history['40.73,-74.03']['2026-10-29T14']).toEqual(['cloudy', 1, 54])

    const stored = await repo.getAllWeatherDays()
    expect(stored).toHaveLength(1)
    expect(stored[0].hours['14']).toEqual(['cloudy', 1, 54])

    _resetWeatherStoreForTests() // a fresh start (page reload)
    expect(s().history).toEqual({})
    await s().reloadHistory()
    expect(s().history['40.73,-74.03']['2026-10-29T14']).toEqual(['cloudy', 1, 54])
  })

  it('prunes recorded days older than the cutoff', async () => {
    await repo.saveWeatherDay({ id: 'old', date: '2020-01-01', lat: 1, lon: 1, label: '', hours: { 10: ['rain', 1, 40] } })
    await repo.saveWeatherDay({ id: 'new', date: '2026-10-01', lat: 1, lon: 1, label: '', hours: { 10: ['clear', 1, 60] } })
    await repo.pruneWeatherDays('2025-01-01')
    expect((await repo.getAllWeatherDays()).map((d) => d.id)).toEqual(['new'])
  })
})
