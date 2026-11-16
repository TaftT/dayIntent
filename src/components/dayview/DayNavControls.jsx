import { usePaneNavigate } from '../../hooks/usePane.jsx'
import { useCanShowWeek } from '../../hooks/useIsWide.js'
import { addDaysStr, todayStr, formatDayHeading, formatRangeHeading, isTodayStr } from '../../utils/dateUtils.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useEntityStore } from '../../store/useEntityStore.js'

// `mode` is 'day' (default) or 'week': the same controls drive both views,
// stepping by a day or a week and linking between them.
export function DayNavControls({ date, mode = 'day' }) {
  const navigate = usePaneNavigate()
  const openModal = useAppStore((s) => s.openModal)
  const splitOpen = useAppStore((s) => s.splitOpen)
  const canShowWeek = useCanShowWeek()
  const canUndoMove = useEntityStore((s) => s.moveHistory.length > 0)
  const undoLastMove = useEntityStore((s) => s.undoLastMove)
  const isWeek = mode === 'week'
  const unit = isWeek ? 'week' : 'day'
  const goTo = (d) => navigate(`/${unit}/${d}`)
  const atToday = isTodayStr(date)
  // Seven columns don't fit beside a split view, so the toggle is hidden then.
  const showToggle = canShowWeek && !splitOpen

  return (
    <div className="day-nav-controls">
      {isWeek && (
        <button className="icon-button" onClick={() => goTo(addDaysStr(date, -7))} aria-label="Back 7 days" title="Back 7 days">
          «
        </button>
      )}
      <button className="icon-button" onClick={() => goTo(addDaysStr(date, -1))} aria-label={isWeek ? 'Start one day earlier' : 'Previous day'}>
        ‹
      </button>
      <button className="btn btn-subtle today-button" onClick={() => goTo(todayStr())} disabled={atToday}>
        Today
      </button>
      <button className="icon-button" onClick={() => goTo(addDaysStr(date, 1))} aria-label={isWeek ? 'Start one day later' : 'Next day'}>
        ›
      </button>
      {isWeek && (
        <button className="icon-button" onClick={() => goTo(addDaysStr(date, 7))} aria-label="Forward 7 days" title="Forward 7 days">
          »
        </button>
      )}
      <button
        className="day-heading"
        onClick={() => openModal('datePicker', { date, onPick: goTo })}
        aria-label="Jump to date"
      >
        {isWeek ? formatRangeHeading(date) : formatDayHeading(date)}
      </button>
      {canUndoMove && (
        <button
          type="button"
          className="icon-button undo-move-button"
          onClick={undoLastMove}
          aria-label="Undo last move"
          title="Undo last move (Ctrl+Z)"
        >
          ↶
        </button>
      )}
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
