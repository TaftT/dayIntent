import { timeStrToMinutes, minutesToTimeStr, formatTimeLabel } from '../../utils/dateUtils.js'

export function DurationStepper({ durationMinutes, onChange, startTime, info }) {
  const isReminder = durationMinutes === null

  // Stepping below 10 minutes drops into "no duration" (a reminder) instead
  // of a separate toggle — decrement past the floor, increment back out of it.
  const decrement = () => {
    if (isReminder) return
    onChange(durationMinutes <= 10 ? null : durationMinutes - 10)
  }
  const increment = () => onChange(isReminder ? 10 : durationMinutes + 10)

  // minutesToTimeStr clamps to 23:59 rather than wrapping — fine for a plain
  // start-time field, but an overnight duration (e.g. sleep) needs the end
  // time to actually roll into the next day instead of freezing at 11:59 PM.
  let endTimeLabel = null
  if (startTime && !isReminder) {
    const endMinutesTotal = timeStrToMinutes(startTime) + durationMinutes
    const daysOffset = Math.floor(endMinutesTotal / 1440)
    endTimeLabel = formatTimeLabel(minutesToTimeStr(endMinutesTotal % 1440))
    if (daysOffset > 0) endTimeLabel += ` (+${daysOffset}d)`
  }

  return (
    <div className="duration-stepper">
      <div className="stepper-controls">
        <button
          type="button"
          className="btn btn-subtle stepper-btn"
          onClick={decrement}
          disabled={isReminder}
          aria-label="Decrease duration by 10 minutes"
        >
          −
        </button>
        <span className="stepper-value">
          {isReminder ? 'No duration (reminder)' : formatDuration(durationMinutes)}
          {info}
        </span>
        <button
          type="button"
          className="btn btn-subtle stepper-btn"
          onClick={increment}
          aria-label="Increase duration by 10 minutes"
        >
          +
        </button>
      </div>
      {endTimeLabel && <span className="stepper-end-time">ends {endTimeLabel}</span>}
    </div>
  )
}

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  if (h === 0) return `${m} min`
  if (m === 0) return `${h} hr`
  return `${h} hr ${m} min`
}
