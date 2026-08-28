import { useEntityStore } from '../../store/useEntityStore.js'
import { computeCategoryTime } from '../../utils/statsAggregations.js'
import { formatMinutesShort } from '../../utils/dateUtils.js'

export function CategoryTimeSection({ from, to }) {
  const items = useEntityStore((s) => s.items)
  const categories = useEntityStore((s) => s.categories)
  const allInstances = useEntityStore((s) => s.allInstances)

  const { rows, totalMinutes } = computeCategoryTime(allInstances, items, categories, from, to)
  const max = rows.length > 0 ? rows[0].minutes : 0

  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <h2>Time by category</h2>
        <span className="stats-section-total">{formatMinutesShort(totalMinutes)} tracked</span>
      </div>
      <p className="stats-section-hint">Completed and worked-on time only, over the selected range.</p>
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
                  style={{
                    width: `${max > 0 ? (row.minutes / max) * 100 : 0}%`,
                    background: row.color,
                  }}
                />
              </div>
              <span className="category-time-value">{formatMinutesShort(row.minutes)}</span>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
