import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { format, isSameMonth } from 'date-fns'
import { Icon } from '../shared/Icon.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useMonthGridDays } from '../../hooks/useMonthGridDays.js'
import { todayStr, addDaysStr, toDateStr } from '../../utils/dateUtils.js'

const MENU_HEIGHT_ESTIMATE = 420

// Per-row "put this on the calendar" action: Today / Tomorrow / a month
// calendar, so scheduling never needs a drag. Picking a day jumps straight to
// it and flashes the item, so you see where it landed. For an already-
// scheduled item the same menu reschedules it or sends it back to To do.
export function ScheduleMenu({ item, instanceId }) {
  const navigate = useNavigate()
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)
  const unscheduleInstance = useEntityStore((s) => s.unscheduleInstance)
  const flashItem = useAppStore((s) => s.flashItem)
  const { monthAnchor, days, goToPrevMonth, goToNextMonth } = useMonthGridDays()
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const scheduled = Boolean(instanceId)
  const today = todayStr()

  // Fixed positioning (computed on open) so the list's own scroll container
  // can't clip the menu; flips above the button when there's no room below.
  const toggle = (e) => {
    e.stopPropagation()
    if (open) return setOpen(false)
    const rect = btnRef.current.getBoundingClientRect()
    const flip = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE && rect.top > MENU_HEIGHT_ESTIMATE / 2
    setPos({
      right: Math.max(8, window.innerWidth - rect.right),
      ...(flip ? { bottom: window.innerHeight - rect.top + 4 } : { top: rect.bottom + 4 }),
    })
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!menuRef.current?.contains(e.target) && !btnRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        setOpen(false)
      }
    }
    const close = (e) => {
      // Scrolling inside the menu itself shouldn't dismiss it.
      if (e?.target && menuRef.current?.contains(e.target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    window.addEventListener('resize', close)
    document.addEventListener('scroll', close, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
      window.removeEventListener('resize', close)
      document.removeEventListener('scroll', close, true)
    }
  }, [open])

  const schedule = async (date) => {
    setOpen(false)
    await scheduleItemOnDate(item.id, date, {})
    flashItem(item.id)
    navigate(`/day/${date}`)
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="backlog-schedule-btn"
        aria-label={scheduled ? 'Reschedule' : 'Schedule'}
        title={scheduled ? 'Reschedule' : 'Schedule'}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={toggle}
      >
        <Icon name="day" size={18} />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="backlog-schedule-menu"
          style={pos}
          role="dialog"
          aria-label="Schedule"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="backlog-schedule-quick">
            <button type="button" onClick={() => schedule(today)}>
              Today
            </button>
            <button type="button" onClick={() => schedule(addDaysStr(today, 1))}>
              Tomorrow
            </button>
          </div>

          <div className="mini-calendar">
            <div className="mini-calendar-header">
              <button type="button" className="icon-button" onClick={goToPrevMonth} aria-label="Previous month">
                ‹
              </button>
              <span className="mini-calendar-month-label">{format(monthAnchor, 'MMMM yyyy')}</span>
              <button type="button" className="icon-button" onClick={goToNextMonth} aria-label="Next month">
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
                    type="button"
                    disabled={dateStr < today}
                    className={[
                      'mini-calendar-day',
                      !isSameMonth(day, monthAnchor) && 'outside-month',
                      dateStr === today && 'is-today',
                    ]
                      .filter(Boolean)
                      .join(' ')}
                    onClick={() => schedule(dateStr)}
                  >
                    {format(day, 'd')}
                  </button>
                )
              })}
            </div>
          </div>

          {scheduled && (
            <button
              type="button"
              className="backlog-schedule-unschedule"
              onClick={async () => {
                setOpen(false)
                await unscheduleInstance(instanceId)
              }}
            >
              Back to To do
            </button>
          )}
        </div>
      )}
    </>
  )
}
