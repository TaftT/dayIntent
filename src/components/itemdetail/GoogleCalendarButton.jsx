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
      <button type="button" className="gcal-btn" disabled title="Give it a date first">
        + Google Calendar
      </button>
    )
  }

  return (
    <>
      <a
        className="gcal-btn"
        href={buildGoogleCalendarUrl(task)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={onShared}
        title={sharedAt ? `Shared ${sharedOn} — tap to add it again` : 'Add this to a Google Calendar'}
      >
        {sharedAt ? '✓ Google Calendar · again' : '+ Google Calendar'}
      </a>
      {sharedOn && <span className="gcal-shared-note">Shared {sharedOn}</span>}
    </>
  )
}
