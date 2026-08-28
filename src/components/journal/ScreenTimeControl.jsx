import { useEffect, useState } from 'react'

// Logs the day's total screen time. Stored on the journal entry as a single
// minute count; edited here as separate hours/minutes fields since that's
// how phone screen-time reports present it.
export function ScreenTimeControl({ minutes, onChange }) {
  const [hours, setHours] = useState('')
  const [mins, setMins] = useState('')

  // Re-seed the fields whenever the saved value changes (day switch, sync).
  useEffect(() => {
    if (minutes == null) {
      setHours('')
      setMins('')
    } else {
      setHours(String(Math.floor(minutes / 60)))
      setMins(String(minutes % 60))
    }
  }, [minutes])

  const commit = (nextHours, nextMins) => {
    const h = parseInt(nextHours, 10)
    const m = parseInt(nextMins, 10)
    if ((nextHours === '' || Number.isNaN(h)) && (nextMins === '' || Number.isNaN(m))) {
      onChange(null)
      return
    }
    const total = (Number.isNaN(h) ? 0 : h) * 60 + (Number.isNaN(m) ? 0 : m)
    onChange(Math.max(0, total))
  }

  return (
    <div className="screen-time-control">
      <h4>Screen time</h4>
      <div className="screen-time-inputs">
        <label>
          <input
            type="number"
            min="0"
            inputMode="numeric"
            value={hours}
            onChange={(e) => {
              setHours(e.target.value)
              commit(e.target.value, mins)
            }}
          />
          h
        </label>
        <label>
          <input
            type="number"
            min="0"
            max="59"
            inputMode="numeric"
            value={mins}
            onChange={(e) => {
              setMins(e.target.value)
              commit(hours, e.target.value)
            }}
          />
          m
        </label>
      </div>
    </div>
  )
}
