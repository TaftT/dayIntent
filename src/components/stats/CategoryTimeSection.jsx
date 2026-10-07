import { useEntityStore } from '../../store/useEntityStore.js'
import { computeUnscheduledTime } from '../../utils/statsAggregations.js'
import { formatMinutesShort } from '../../utils/dateUtils.js'

// Every bar is a share of waking time, so bars are comparable across rows.
function share(value, waking) {
  return waking > 0 ? Math.min(100, (value / waking) * 100) : 0
}

function formatPercent(p) {
  return p > 0 && p < 1 ? '<1%' : `${Math.round(p)}%`
}

function TimeRow({ name, dot, minutes, wakingMinutes, color }) {
  const p = share(minutes, wakingMinutes)
  return (
    <div className="category-time-row">
      <span className="category-time-name">
        {dot && <span className="category-dot" style={{ background: color }} />}
        {name}
      </span>
      <div className="category-time-bar-track">
        <div className="category-time-bar" style={{ width: `${p}%`, background: color }}>
          <span className="category-time-bar-label">{formatPercent(p)}</span>
        </div>
      </div>
      <span className="category-time-value">{formatMinutesShort(minutes)}</span>
    </div>
  )
}

export function CategoryTimeSection({ from, to }) {
  const items = useEntityStore((s) => s.items)
  const categories = useEntityStore((s) => s.categories)
  const allInstances = useEntityStore((s) => s.allInstances)
  const allJournals = useEntityStore((s) => s.allJournals)

  const { taskRows, completedTaskMinutes, downtimeMinutes, wakingMinutes, screenTimeMinutes } =
    computeUnscheduledTime(allInstances, items, categories, allJournals, from, to)

  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <h2>Time by category</h2>
        <span className="stats-section-total">{formatMinutesShort(wakingMinutes)} waking</span>
      </div>
      <p className="stats-section-hint">
        Share of your waking hours (sleep excluded). {formatMinutesShort(completedTaskMinutes)} spent on
        completed or worked-on tasks; down time is everything else.
      </p>

      <div className="category-time-list">
        {taskRows.map((row) => (
          <TimeRow
            key={row.categoryId ?? 'uncategorized'}
            name={row.name}
            dot
            color={row.color}
            minutes={row.minutes}
            wakingMinutes={wakingMinutes}
          />
        ))}
        <TimeRow
          name="Down time"
          color="var(--color-text-muted)"
          minutes={downtimeMinutes}
          wakingMinutes={wakingMinutes}
        />
      </div>

      <div className="category-time-list category-time-extras">
        <TimeRow
          name="Screen time"
          color="var(--color-primary)"
          minutes={screenTimeMinutes}
          wakingMinutes={wakingMinutes}
        />
        <p className="stats-section-hint category-time-extras-note">
          Tracked separately from the above — it usually overlaps with down time.
        </p>
      </div>
    </section>
  )
}
