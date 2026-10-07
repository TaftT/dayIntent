import { useEffect, useRef, useState } from 'react'
import { Icon } from '../shared/Icon.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { todayStr, addDaysStr } from '../../utils/dateUtils.js'

const MENU_HEIGHT_ESTIMATE = 190

// Per-row "put this on the calendar" action: Today / Tomorrow / pick a date,
// so scheduling never needs a drag. For an already-scheduled item the same
// menu reschedules it or sends it back to the To do list.
export function ScheduleMenu({ item, instanceId }) {
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)
  const unscheduleInstance = useEntityStore((s) => s.unscheduleInstance)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const scheduled = Boolean(instanceId)

  // Fixed positioning (computed on open) so the list's own scroll container
  // can't clip the menu; flips above the button when there's no room below.
  const toggle = (e) => {
    e.stopPropagation()
    if (open) return setOpen(false)
    const rect = btnRef.current.getBoundingClientRect()
    const flip = window.innerHeight - rect.bottom < MENU_HEIGHT_ESTIMATE
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
    const close = () => setOpen(false)
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
    if (date) await scheduleItemOnDate(item.id, date, {})
  }

  const today = todayStr()

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="backlog-schedule-btn"
        aria-label={scheduled ? 'Reschedule' : 'Schedule'}
        title={scheduled ? 'Reschedule' : 'Schedule'}
        aria-haspopup="menu"
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
          role="menu"
          onClick={(e) => e.stopPropagation()}
        >
          <button type="button" role="menuitem" onClick={() => schedule(today)}>
            Today
          </button>
          <button type="button" role="menuitem" onClick={() => schedule(addDaysStr(today, 1))}>
            Tomorrow
          </button>
          <label className="backlog-schedule-date">
            Pick a date
            <input
              type="date"
              min={today}
              onChange={(e) => e.target.value && schedule(e.target.value)}
            />
          </label>
          {scheduled && (
            <button
              type="button"
              role="menuitem"
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
