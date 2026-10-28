import { useNavigate } from 'react-router-dom'
import { format, isSameMonth } from 'date-fns'
import { Modal } from '../shared/Modal.jsx'
import { useAppStore } from '../../store/useAppStore.js'
import { useMonthGridDays } from '../../hooks/useMonthGridDays.js'
import { toDateStr, isTodayStr } from '../../utils/dateUtils.js'

export function DatePickerModal({ date, onPick }) {
  const closeModal = useAppStore((s) => s.closeModal)
  const navigate = useNavigate()
  const { monthAnchor, days, goToPrevMonth, goToNextMonth } = useMonthGridDays(date)

  const goToDate = (dateStr) => {
    if (onPick) onPick(dateStr)
    else navigate(`/day/${dateStr}`)
    closeModal()
  }

  return (
    <Modal title="Jump to date" onClose={closeModal} width={320}>
      <div className="mini-calendar">
        <div className="mini-calendar-header">
          <button className="icon-button" onClick={goToPrevMonth} aria-label="Previous month">
            ‹
          </button>
          <span>{format(monthAnchor, 'MMMM yyyy')}</span>
          <button className="icon-button" onClick={goToNextMonth} aria-label="Next month">
            ›
          </button>
        </div>
        <div className="mini-calendar-grid">
          {['S', 'M', 'T', 'W', 'T', 'F', 'S'].map((d, i) => (
            <div key={i} className="mini-calendar-weekday">
              {d}
            </div>
          ))}
          {days.map((day) => {
            const dateStr = toDateStr(day)
            return (
              <button
                key={day.toISOString()}
                className={[
                  'mini-calendar-day',
                  !isSameMonth(day, monthAnchor) && 'outside-month',
                  isTodayStr(dateStr) && 'is-today',
                  dateStr === date && 'is-selected',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => goToDate(dateStr)}
              >
                {format(day, 'd')}
              </button>
            )
          })}
        </div>
      </div>
    </Modal>
  )
}
