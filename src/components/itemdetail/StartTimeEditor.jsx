import { minutesToTimeStr, timeStrToMinutes, formatTimeLabel } from '../../utils/dateUtils.js'
import { TIME_OPTIONS, LAST_SLOT_MINUTES } from '../../utils/timeOptions.js'

export function StartTimeEditor({ time, onChange }) {
  const minutes = timeStrToMinutes(time)

  const decrement = () => onChange(minutesToTimeStr(Math.max(0, minutes - 10)))
  const increment = () => onChange(minutesToTimeStr(Math.min(LAST_SLOT_MINUTES, minutes + 10)))

  return (
    <div className="start-time-editor">
      <button
        type="button"
        className="btn btn-subtle stepper-btn"
        onClick={decrement}
        disabled={minutes <= 0}
        aria-label="Earlier by 10 minutes"
      >
        −
      </button>
      <select value={time} onChange={(e) => onChange(e.target.value)} aria-label="Start time">
        {TIME_OPTIONS.map((t) => (
          <option key={t} value={t}>
            {formatTimeLabel(t)}
          </option>
        ))}
      </select>
      <button
        type="button"
        className="btn btn-subtle stepper-btn"
        onClick={increment}
        disabled={minutes >= LAST_SLOT_MINUTES}
        aria-label="Later by 10 minutes"
      >
        +
      </button>
    </div>
  )
}
