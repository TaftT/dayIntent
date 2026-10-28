import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import { usePaneNavigate } from '../../hooks/usePane.jsx'
import { endOfMonth, startOfMonth, addMonths, format } from 'date-fns'
import { TopBar } from '../layout/TopBar.jsx'
import { KebabMenu } from '../shared/KebabMenu.jsx'
import { EntryEditor } from './EntryEditor.jsx'
import { useAppStore } from '../../store/useAppStore.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { isRichTextEmpty } from '../../utils/richText.js'
import { formatDayHeading, fromDateStr, toDateStr, todayStr } from '../../utils/dateUtils.js'

const isBlank = (html) => (html ?? '').replace(/<[^>]*>|&nbsp;/g, '').trim() === ''

const monthRangeOf = (date) => ({ from: toDateStr(startOfMonth(date)), to: toDateStr(endOfMonth(date)) })

// Read-through of past journal entries: oldest at the top, newest at the
// bottom, and the page opens scrolled to the newest. Defaults to the current
// month; the range can be stepped by month or set to any custom dates.
export function JournalViewPage() {
  const allJournals = useEntityStore((s) => s.allJournals)
  const allInstances = useEntityStore((s) => s.allInstances)
  const items = useEntityStore((s) => s.items)
  const [range, setRange] = useState(() => monthRangeOf(new Date()))
  const scrollRef = useRef(null)
  const navigate = usePaneNavigate()
  const openModal = useAppStore((s) => s.openModal)
  const setExcluded = useEntityStore((s) => s.setInstanceJournalExcluded)
  // Editing a day's journal text happens in the day view's journal panel.
  const editDay = (date) => {
    useAppStore.setState({ journalOpen: true })
    navigate(`/day/${date}`)
  }

  // Item notes the user hasn't toggled out of the journal, keyed by date.
  const notesByDate = useMemo(() => {
    const map = new Map()
    for (const inst of allInstances) {
      if (inst.journalExcluded || isRichTextEmpty(inst.notes)) continue
      if (inst.date < range.from || inst.date > range.to) continue
      const item = items.find((i) => i.id === inst.itemId)
      if (!item) continue
      map.set(inst.date, [
        ...(map.get(inst.date) ?? []),
        { id: inst.id, itemId: item.id, date: inst.date, title: item.title, notes: inst.notes },
      ])
    }
    return map
  }, [allInstances, items, range])

  const entries = useMemo(() => {
    const byDate = new Map(allJournals.map((j) => [j.date, j]))
    const dates = new Set([...byDate.keys(), ...notesByDate.keys()])
    const today = todayStr()
    // Today is always listed (when in range) so there's somewhere to write it.
    return [...dates, ...(today >= range.from && today <= range.to ? [today] : [])]
      .filter((d, i, all) => all.indexOf(d) === i)
      .filter((d) => d >= range.from && d <= range.to)
      .map((d) => ({ ...(byDate.get(d) ?? { date: d }), itemNotes: notesByDate.get(d) ?? [] }))
      .filter((j) => j.date === today || !isBlank(j.content) || j.mood || j.spouseMood || j.itemNotes.length > 0)
      .sort((a, b) => a.date.localeCompare(b.date))
  }, [allJournals, notesByDate, range])

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
                <a
                  href={`/day/${j.date}`}
                  onClick={(e) => {
                    e.preventDefault()
                    navigate(`/day/${j.date}`)
                  }}
                >
                  {formatDayHeading(j.date)}
                </a>
                <span className="journal-view-moods">
                  {j.mood}
                  {j.spouseMood ? ` ${j.spouseMood}` : ''}
                </span>
                <KebabMenu
                  label={`Actions for ${formatDayHeading(j.date)}`}
                  actions={[{ label: 'Edit', onClick: () => editDay(j.date) }]}
                />
              </header>
              {j.date === todayStr() ? (
                <EntryEditor date={j.date} placeholder="Write today's journal…" />
              ) : (
                !isBlank(j.content) && (
                  <div className="journal-view-entry-body" dangerouslySetInnerHTML={{ __html: j.content }} />
                )
              )}
              {j.itemNotes.map((n) => (
                <div key={n.id} className="day-item-note">
                  <div className="day-item-note-header">
                    <div className="day-item-note-title">{n.title}</div>
                    <KebabMenu
                      label={`Actions for ${n.title}`}
                      actions={[
                        { label: 'Edit', onClick: () => openModal('itemDetail', { itemId: n.itemId, instanceId: n.id, date: n.date }) },
                        { label: 'Hide from journal', onClick: () => setExcluded(n.id, true) },
                      ]}
                    />
                  </div>
                  <div className="day-item-note-body" dangerouslySetInnerHTML={{ __html: n.notes }} />
                </div>
              ))}
            </article>
          ))
        )}
      </div>
    </div>
  )
}
