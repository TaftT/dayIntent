import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { endOfMonth, startOfMonth, addMonths, format } from 'date-fns'
import { TopBar } from '../layout/TopBar.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { formatDayHeading, fromDateStr, toDateStr, todayStr } from '../../utils/dateUtils.js'

const isBlank = (html) => (html ?? '').replace(/<[^>]*>|&nbsp;/g, '').trim() === ''

const monthRangeOf = (date) => ({ from: toDateStr(startOfMonth(date)), to: toDateStr(endOfMonth(date)) })

// Read-through of past journal entries: oldest at the top, newest at the
// bottom, and the page opens scrolled to the newest. Defaults to the current
// month; the range can be stepped by month or set to any custom dates.
export function JournalViewPage() {
  const allJournals = useEntityStore((s) => s.allJournals)
  const [range, setRange] = useState(() => monthRangeOf(new Date()))
  const scrollRef = useRef(null)

  const entries = useMemo(
    () =>
      allJournals
        .filter((j) => j.date >= range.from && j.date <= range.to)
        .filter((j) => !isBlank(j.content) || j.mood || j.spouseMood)
        .sort((a, b) => a.date.localeCompare(b.date)),
    [allJournals, range],
  )

  // Land on the newest entry whenever the page opens or the range changes.
  useLayoutEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [range, entries.length])

  const stepMonth = (n) => setRange(monthRangeOf(addMonths(fromDateStr(range.from), n)))
  const thisMonth = monthRangeOf(new Date())
  const isThisMonth = range.from === thisMonth.from && range.to === thisMonth.to
  const label = format(fromDateStr(range.from), 'MMMM yyyy')
  const isFullMonth = range.from === toDateStr(startOfMonth(fromDateStr(range.from))) && range.to === toDateStr(endOfMonth(fromDateStr(range.from)))

  return (
    <div className="stats-page">
      <TopBar />
      <div className="journal-view-controls">
        <div className="stats-range-nav">
          <button type="button" className="stats-range-arrow" onClick={() => stepMonth(-1)} aria-label="Previous month">
            ‹
          </button>
          <span className="stats-range-label">{isFullMonth ? label : 'Custom range'}</span>
          <button
            type="button"
            className="stats-range-arrow"
            onClick={() => stepMonth(1)}
            disabled={range.from.slice(0, 7) >= todayStr().slice(0, 7)}
            aria-label="Next month"
          >
            ›
          </button>
          {!isThisMonth && (
            <button type="button" className="stats-range-preset" onClick={() => setRange(monthRangeOf(new Date()))}>
              This month
            </button>
          )}
        </div>
        <div className="stats-range-dates">
          <label>
            From
            <input type="date" value={range.from} max={range.to} onChange={(e) => e.target.value && setRange({ ...range, from: e.target.value })} />
          </label>
          <label>
            To
            <input type="date" value={range.to} min={range.from} onChange={(e) => e.target.value && setRange({ ...range, to: e.target.value })} />
          </label>
        </div>
      </div>
      <div className="stats-page-content journal-view-scroll" ref={scrollRef}>
        {entries.length === 0 ? (
          <p className="journal-view-empty">No journal entries in this range.</p>
        ) : (
          entries.map((j) => (
            <article key={j.date} className="journal-view-entry">
              <header className="journal-view-entry-header">
                <Link to={`/day/${j.date}`}>{formatDayHeading(j.date)}</Link>
                <span className="journal-view-moods">
                  {j.mood}
                  {j.spouseMood ? ` ${j.spouseMood}` : ''}
                </span>
              </header>
              {!isBlank(j.content) && (
                <div className="journal-view-entry-body" dangerouslySetInnerHTML={{ __html: j.content }} />
              )}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
