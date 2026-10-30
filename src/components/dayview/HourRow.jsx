import { HOUR_HEIGHT } from './gridConstants.js'
import { formatTimeLabel } from '../../utils/dateUtils.js'
import { conditionIcon, conditionLabel } from '../../weather/conditions.js'

export function HourRow({ hour, weather, showPlace = false }) {
  const label = formatTimeLabel(`${String(hour).padStart(2, '0')}:00`)
  const rain = weather?.precipChance > 0 ? weather.precipChance : null
  const detail = weather
    ? [
        conditionLabel(weather.condition),
        weather.tempF != null && `${weather.tempF}°F`,
        rain != null && `${rain}% chance of rain`,
        weather.observed && 'recorded',
        weather.place && `at ${weather.place}`,
      ]
        .filter(Boolean)
        .join(' · ')
    : null
  return (
    <div className="hour-row" style={{ height: HOUR_HEIGHT }}>
      <div className="hour-label">{hour === 0 ? '' : label}</div>
      {weather && (
        <div className="hour-weather" title={detail} aria-label={detail}>
          <span className="hour-weather-main">
            <span className="hour-weather-icon">{conditionIcon(weather.condition, weather.isDaytime)}</span>
            {weather.tempF != null && <span className="hour-weather-temp">{weather.tempF}°</span>}
          </span>
          {showPlace && weather.place && <span className="hour-weather-place">📍{weather.place}</span>}
          {rain != null && <span className="hour-weather-rain">💧{rain}%</span>}
        </div>
      )}
      <div className="hour-line" />
    </div>
  )
}
