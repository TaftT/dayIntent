import { useEntityStore } from '../../store/useEntityStore.js'
import { computeMoodStats, formatScore } from '../../utils/moodTally.js'
import { formatShortDate } from '../../utils/dateUtils.js'

const MAX_STRIP_DAYS = 92

const PEOPLE = [
  { who: 'me', label: 'Me' },
  { who: 'others', label: 'Others' },
]

// One bar per day, rising above the centre line for a positive day and
// falling below it for a negative one.
function ScoreStrip({ days, maxAbs }) {
  return (
    <div className="mood-strip">
      {days.map((d) => {
        const pct = d.score != null && maxAbs > 0 ? (Math.abs(d.score) / maxAbs) * 50 : 0
        return (
          <div
            key={d.date}
            className={`mood-strip-day ${d.score == null ? 'empty' : ''}`}
            title={`${formatShortDate(d.date)}: ${d.score == null ? 'nothing logged' : formatScore(d.score)}`}
          >
            {d.score != null && d.score !== 0 && (
              <div
                className={`mood-strip-bar ${d.score > 0 ? 'positive' : 'negative'}`}
                style={{ height: `${Math.max(pct, 2)}%` }}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

export function MoodSection({ from, to }) {
  const allJournals = useEntityStore((s) => s.allJournals)
  const stats = PEOPLE.map((p) => ({ ...p, ...computeMoodStats(allJournals, p.who, from, to) }))
  // One shared scale so the two charts can be compared at a glance.
  const maxAbs = Math.max(0, ...stats.flatMap((s) => s.days.map((d) => Math.abs(d.score ?? 0))))
  const anyLogged = stats.some((s) => s.loggedDays > 0)

  return (
    <section className="stats-section">
      <div className="stats-section-header">
        <h2>Mood</h2>
      </div>
      <p className="stats-section-hint">
        From the + and − taps in each day&apos;s journal. A day&apos;s score is positives minus negatives.
      </p>
      {!anyLogged ? (
        <div className="empty-state">No mood logged in this range.</div>
      ) : (
        stats.map((s) => (
          <div key={s.who} className="mood-stats-person">
            <h3 className="mood-stats-name">{s.label}</h3>
            {s.loggedDays === 0 ? (
              <div className="empty-state">Nothing logged for {s.label.toLowerCase()} in this range.</div>
            ) : (
              <>
                <div className="stat-tile-row">
                  <div className="stat-tile">
                    <span className="stat-tile-value">{formatScore(s.average)}</span>
                    <span className="stat-tile-label">Average day</span>
                  </div>
                  <div className="stat-tile">
                    <span className="stat-tile-value">{s.positiveDays}</span>
                    <span className="stat-tile-label">Positive days</span>
                  </div>
                  <div className="stat-tile">
                    <span className="stat-tile-value">{s.negativeDays}</span>
                    <span className="stat-tile-label">Negative days</span>
                  </div>
                  <div className="stat-tile">
                    <span className="stat-tile-value">
                      {formatScore(s.best.score)} / {formatScore(s.worst.score)}
                    </span>
                    <span className="stat-tile-label">Best / worst</span>
                  </div>
                </div>
                {s.days.length <= MAX_STRIP_DAYS ? (
                  <ScoreStrip days={s.days} maxAbs={maxAbs} />
                ) : (
                  <p className="stats-section-hint">Pick a range of {MAX_STRIP_DAYS} days or fewer to see the daily chart.</p>
                )}
              </>
            )}
          </div>
        ))
      )}
    </section>
  )
}
