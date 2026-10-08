import { buildGoogleCalendarUrl } from '../../utils/googleCalendar.js'
import { formatShortDate, toDateStr } from '../../utils/dateUtils.js'

// "Add to Google Calendar": opens Google's own add-event page prefilled with
// this task, where you pick the calendar and confirm. We can't see whether
// the event was actually saved over there, so clicking the button is what
// marks the task as shared. It can be shared again any time (e.g. after
// changing its time), which just opens a fresh prefilled page.
export function GoogleCalendarButton({ task, sharedAt, onShared }) {
  const sharedOn = sharedAt ? formatShortDate(toDateStr(new Date(sharedAt))) : null

  if (!task.date) {
    return (
      <button type="button" className="btn btn-subtle gcal-btn" disabled title="Give it a date first">
        Add to Google Calendar
      </button>
    )
  }

  return (
    <div className="gcal-row">
      <a
        className="btn btn-subtle gcal-btn"
        href={buildGoogleCalendarUrl(task)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onShared}
      >
        {sharedAt ? 'Add to Google Calendar again' : 'Add to Google Calendar'}
      </a>
      {sharedOn && <span className="gcal-shared-note">✓ Shared {sharedOn}</span>}
    </div>
  )
}
