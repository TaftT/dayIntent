import { todayStr, addDaysStr } from '../../utils/dateUtils.js'

// Presets are offsets back from today; `null` days means "all time" and is
// resolved by the caller (it has the earliest record on hand).
const PRESETS = [
  { label: '7 days', days: 7 },
  { label: '30 days', days: 30 },
  { label: '90 days', days: 90 },
]

export function rangeForPresetDays(days) {
  const to = todayStr()
  return { from: addDaysStr(to, -(days - 1)), to }
}

export function StatsRangeControl({ from, to, onChange }) {
  const activePresetDays = PRESETS.find((p) => {
    const r = rangeForPresetDays(p.days)
    return r.from === from && r.to === to
  })?.days

  return (
    <div className="stats-range">
      <div className="stats-range-presets">
        {PRESETS.map((p) => (
          <button
            key={p.days}
            type="button"
            className={`stats-range-preset ${activePresetDays === p.days ? 'active' : ''}`}
            onClick={() => onChange(rangeForPresetDays(p.days))}
          >
            Last {p.label}
          </button>
        ))}
      </div>
      <div className="stats-range-dates">
        <label>
          From
          <input
            type="date"
            value={from}
            max={to}
            onChange={(e) => onChange({ from: e.target.value, to })}
          />
        </label>
        <label>
          To
          <input
            type="date"
            value={to}
            min={from}
            max={todayStr()}
            onChange={(e) => onChange({ from, to: e.target.value })}
          />
        </label>
      </div>
    </div>
  )
}
