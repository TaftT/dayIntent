import { todayStr, addDaysStr, currentWeekRange, formatShortDate } from '../../utils/dateUtils.js'
import { shiftRange } from '../../utils/shiftRange.js'

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

function rangeLabel(from, to) {
  if (from === to) return from === todayStr() ? 'Today' : formatShortDate(from)
  return `${formatShortDate(from)} – ${formatShortDate(to)}`
}

export function StatsRangeControl({ from, to, onChange }) {
  const week = currentWeekRange()
  const isThisWeek = week.from === from && week.to === to
  const isToday = from === todayStr() && to === todayStr()
  const prev = shiftRange({ from, to }, -1)
  const next = shiftRange({ from, to }, 1)

  const activePresetDays = PRESETS.find((p) => {
    const r = rangeForPresetDays(p.days)
    return r.from === from && r.to === to
  })?.days

  return (
    <div className="stats-range">
      <div className="stats-range-presets">
        <button
          type="button"
          className={`stats-range-preset ${isToday ? 'active' : ''}`}
          onClick={() => onChange(rangeForPresetDays(1))}
        >
          Today
        </button>
        <button
          type="button"
          className={`stats-range-preset ${isThisWeek ? 'active' : ''}`}
          onClick={() => onChange(currentWeekRange())}
        >
          This week
        </button>
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
      <div className="stats-range-nav">
        <button
          type="button"
          className="stats-range-arrow"
          onClick={() => prev && onChange(prev)}
          disabled={!prev}
          aria-label="Previous period"
          title="Previous period"
        >
          ‹
        </button>
        <span className="stats-range-label">{rangeLabel(from, to)}</span>
        <button
          type="button"
          className="stats-range-arrow"
          onClick={() => next && onChange(next)}
          disabled={!next}
          aria-label="Next period"
          title="Next period"
        >
          ›
        </button>
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
