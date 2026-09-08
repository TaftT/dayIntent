import { useEntityStore } from '../../store/useEntityStore.js'
import { computeCategoryTime, computeUnscheduledTime } from '../../utils/statsAggregations.js'
import { formatMinutesShort } from '../../utils/dateUtils.js'

function pct(value, max) {
  return `${max > 0 ? Math.min(100, (value / max) * 100) : 0}%`
}

export function CategoryTimeSection({ from, to }) {
  const items = useEntityStore((s) => s.items)
  const categories = useEntityStore((s) => s.categories)
  const allInstances = useEntityStore((s) => s.allInstances)
  const allJournals = useEntityStore((s) => s.allJournals)

  const { rows, totalMinutes } = computeCategoryTime(allInstances, items, categories, from, to)
  const { downtimeMinutes, wakingMinutes, screenTimeMinutes } = computeUnscheduledTime(
    allInstances,
    items,
    categories,
    allJournals,
    from,
    to
  )
  const max = rows.length > 0 ? rows[0].minutes : 0

  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <h2>Time by category</h2>
        <span className="stats-section-total">{formatMinutesShort(totalMinutes)} tracked</span>
      </div>
      <p className="stats-section-hint">
        Completed and worked-on time by category. Down time is waking hours (sleep excluded) with no
        completed task; screen time is what you logged in the journal.
      </p>

      {rows.length === 0 ? (
        <div className="empty-state">Nothing finalized in this range yet.</div>
      ) : (
        <div className="category-time-list">
          {rows.map((row) => (
            <div className="category-time-row" key={row.categoryId ?? 'uncategorized'}>
              <span className="category-time-name">
                <span className="category-dot" style={{ background: row.color }} />
                {row.name}
              </span>
              <div className="category-time-bar-track">
                <div
                  className="category-time-bar"
                  style={{ width: pct(row.minutes, max), background: row.color }}
                />
              </div>
              <span className="category-time-value">{formatMinutesShort(row.minutes)}</span>
            </div>
          ))}
        </div>
      )}

      <div className="category-time-list category-time-extras">
        <div className="category-time-row">
          <span className="category-time-name">Down time</span>
          <div className="category-time-bar-track">
            <div
              className="category-time-bar"
              style={{ width: pct(downtimeMinutes, wakingMinutes), background: 'var(--color-text-muted)' }}
            />
          </div>
          <span className="category-time-value">{formatMinutesShort(downtimeMinutes)}</span>
        </div>
        <div className="category-time-row">
          <span className="category-time-name">Screen time</span>
          <div className="category-time-bar-track">
            <div
              className="category-time-bar"
              style={{ width: pct(screenTimeMinutes, wakingMinutes), background: 'var(--color-primary)' }}
            />
          </div>
          <span className="category-time-value">{formatMinutesShort(screenTimeMinutes)}</span>
        </div>
      </div>
    </section>
  )
}
