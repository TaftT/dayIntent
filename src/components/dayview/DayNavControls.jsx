import { usePaneNavigate } from '../../hooks/usePane.jsx'
import { useCanShowWeek } from '../../hooks/useIsWide.js'
import { addDaysStr, todayStr, formatDayHeading, formatWeekHeading, isTodayStr, weekStartStr } from '../../utils/dateUtils.js'
import { useAppStore } from '../../store/useAppStore.js'

// `mode` is 'day' (default) or 'week': the same controls drive both views,
// stepping by a day or a week and linking between them.
export function DayNavControls({ date, mode = 'day' }) {
  const navigate = usePaneNavigate()
  const openModal = useAppStore((s) => s.openModal)
  const splitOpen = useAppStore((s) => s.splitOpen)
  const canShowWeek = useCanShowWeek()
  const isWeek = mode === 'week'
  const step = isWeek ? 7 : 1
  const unit = isWeek ? 'week' : 'day'
  const goTo = (d) => navigate(`/${unit}/${d}`)
  const atToday = isWeek ? weekStartStr(date) === weekStartStr(todayStr()) : isTodayStr(date)
  // Seven columns don't fit beside a split view, so the toggle is hidden then.
  const showToggle = canShowWeek && !splitOpen

  return (
    <div className="day-nav-controls">
      <button className="icon-button" onClick={() => goTo(addDaysStr(date, -step))} aria-label={`Previous ${unit}`}>
        ‹
      </button>
      <button className="btn btn-subtle today-button" onClick={() => goTo(todayStr())} disabled={atToday}>
        Today
      </button>
      <button className="icon-button" onClick={() => goTo(addDaysStr(date, step))} aria-label={`Next ${unit}`}>
        ›
      </button>
      <button
        className="day-heading"
        onClick={() => openModal('datePicker', { date, onPick: goTo })}
        aria-label="Jump to date"
      >
        {isWeek ? formatWeekHeading(date) : formatDayHeading(date)}
      </button>
      {showToggle && (
        <div className="view-toggle" role="group" aria-label="Calendar view">
          <button
            type="button"
            className={isWeek ? 'view-toggle-btn' : 'view-toggle-btn active'}
            aria-pressed={!isWeek}
            onClick={() => isWeek && navigate(`/day/${date}`)}
          >
            Day
          </button>
          <button
            type="button"
            className={isWeek ? 'view-toggle-btn active' : 'view-toggle-btn'}
            aria-pressed={isWeek}
            onClick={() => !isWeek && navigate(`/week/${date}`)}
          >
            Week
          </button>
        </div>
      )}
    </div>
  )
}
