// Provider-neutral weather conditions. Each provider maps whatever its API
// returns (text, numeric codes, icon URLs) onto one of these keys, so the UI
// only ever deals with this small fixed vocabulary.

export const CONDITIONS = {
  clear: { label: 'Clear', day: '☀️', night: '🌙' },
  'mostly-clear': { label: 'Mostly clear', day: '🌤️', night: '🌙' },
  'partly-cloudy': { label: 'Partly cloudy', day: '⛅', night: '☁️' },
  cloudy: { label: 'Cloudy', day: '☁️', night: '☁️' },
  fog: { label: 'Fog or haze', day: '🌫️', night: '🌫️' },
  drizzle: { label: 'Drizzle', day: '🌦️', night: '🌧️' },
  rain: { label: 'Rain', day: '🌧️', night: '🌧️' },
  thunder: { label: 'Thunderstorms', day: '⛈️', night: '⛈️' },
  snow: { label: 'Snow', day: '🌨️', night: '🌨️' },
  sleet: { label: 'Sleet or freezing rain', day: '🌨️', night: '🌨️' },
  wind: { label: 'Windy', day: '💨', night: '💨' },
}

export const UNKNOWN_CONDITION = 'cloudy'

/** Emoji for a condition, falling back sensibly for unknown keys. */
export function conditionIcon(condition, isDaytime = true) {
  const c = CONDITIONS[condition] ?? CONDITIONS[UNKNOWN_CONDITION]
  return isDaytime ? c.day : c.night
}

export function conditionLabel(condition) {
  return (CONDITIONS[condition] ?? CONDITIONS[UNKNOWN_CONDITION]).label
}
