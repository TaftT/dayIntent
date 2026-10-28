import { usePaneNavigate } from '../../hooks/usePane.jsx'
import { addDaysStr, todayStr, formatDayHeading, isTodayStr } from '../../utils/dateUtils.js'
import { useAppStore } from '../../store/useAppStore.js'

export function DayNavControls({ date }) {
  const navigate = usePaneNavigate()
  const openModal = useAppStore((s) => s.openModal)
  const goTo = (d) => navigate(`/day/${d}`)

  return (
    <div className="day-nav-controls">
      <button className="icon-button" onClick={() => goTo(addDaysStr(date, -1))} aria-label="Previous day">
        ‹
      </button>
      <button className="btn btn-subtle today-button" onClick={() => goTo(todayStr())} disabled={isTodayStr(date)}>
        Today
      </button>
      <button className="icon-button" onClick={() => goTo(addDaysStr(date, 1))} aria-label="Next day">
        ›
      </button>
      <button
        className="day-heading"
        onClick={() => openModal('datePicker', { date, onPick: goTo })}
        aria-label="Jump to date"
      >
        {formatDayHeading(date)}
      </button>
    </div>
  )
}
