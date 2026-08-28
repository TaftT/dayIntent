import { useEntityStore } from '../../store/useEntityStore.js'
import { computeScreenTimeStats } from '../../utils/statsAggregations.js'
import { formatMinutesShort, formatShortDate } from '../../utils/dateUtils.js'

const MAX_STRIP_DAYS = 92

export function ScreenTimeSection({ from, to }) {
  const allJournals = useEntityStore((s) => s.allJournals)
  const { days, loggedDays, totalMinutes, avgMinutes, maxMinutes } = computeScreenTimeStats(
    allJournals,
    from,
    to
  )

  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <h2>Screen time</h2>
        <span className="stats-section-total">{formatMinutesShort(totalMinutes)} total</span>
      </div>
      <p className="stats-section-hint">From the screen time you log in each day's journal.</p>
      {loggedDays === 0 ? (
        <div className="empty-state">No screen time logged in this range.</div>
      ) : (
        <>
          <div className="stat-tile-row">
            <div className="stat-tile">
              <span className="stat-tile-value">{formatMinutesShort(avgMinutes)}</span>
              <span className="stat-tile-label">Daily average</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value">{formatMinutesShort(maxMinutes)}</span>
              <span className="stat-tile-label">Highest day</span>
            </div>
            <div className="stat-tile">
              <span className="stat-tile-value">{loggedDays}</span>
              <span className="stat-tile-label">Days logged</span>
            </div>
          </div>
          {days.length <= MAX_STRIP_DAYS ? (
            <div className="screen-time-strip">
              {days.map((d) => (
                <div
                  key={d.date}
                  className={`screen-time-strip-bar ${d.minutes == null ? 'empty' : ''}`}
                  title={`${formatShortDate(d.date)}: ${
                    d.minutes == null ? 'not logged' : formatMinutesShort(d.minutes)
                  }`}
                >
                  {d.minutes != null && (
                    <div
                      className="screen-time-strip-fill"
                      style={{ height: `${maxMinutes > 0 ? (d.minutes / maxMinutes) * 100 : 0}%` }}
                    />
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="stats-section-hint">Pick a range of {MAX_STRIP_DAYS} days or fewer to see the daily chart.</p>
          )}
        </>
      )}
    </section>
  )
}
