// Builds a link to Google Calendar's own "add event" page, prefilled with a
// task. Nothing is sent from the app and no Google sign-in is needed: the
// link just opens calendar.google.com, where the person picks which of their
// calendars the event goes on and confirms it.

const BASE = 'https://calendar.google.com/calendar/render'
const BYDAY = ['SU', 'MO', 'TU', 'WE', 'TH', 'FR', 'SA']
const REMINDER_MINUTES = 15 // a task with no duration still needs an end time

const pad = (n) => String(n).padStart(2, '0')
const ymd = (d) => `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}`
const ymdhms = (d) => `${ymd(d)}T${pad(d.getHours())}${pad(d.getMinutes())}00`

/** Rich-text notes (HTML) → plain text, keeping paragraph/line breaks. */
export function notesToPlainText(html) {
  if (!html) return ''
  return html
    .replace(/<\s*br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li|h[1-6])>/gi, '\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Our recurrence rule → an RRULE string Google understands, or null. */
export function recurrenceToRrule(recurrence) {
  if (!recurrence) return null
  const freq = { daily: 'DAILY', weekly: 'WEEKLY', monthly: 'MONTHLY' }[recurrence.freq]
  if (!freq) return null
  const parts = [`FREQ=${freq}`]
  if (recurrence.interval && recurrence.interval > 1) parts.push(`INTERVAL=${recurrence.interval}`)
  if (freq === 'WEEKLY' && recurrence.byWeekday?.length) {
    parts.push(`BYDAY=${[...recurrence.byWeekday].sort().map((d) => BYDAY[d]).join(',')}`)
  }
  if (recurrence.endDate) parts.push(`UNTIL=${recurrence.endDate.replace(/-/g, '')}`)
  return `RRULE:${parts.join(';')}`
}

/**
 * @param {{title: string, notes?: string, date: string, time?: string|null,
 *          durationMinutes?: number|null, isAllDay?: boolean,
 *          recurrence?: object|null}} task  date is 'YYYY-MM-DD', time 'HH:mm'
 * @returns {string} the URL to open
 */
export function buildGoogleCalendarUrl({ title, notes, date, time, durationMinutes, isAllDay, recurrence }) {
  const [y, m, d] = date.split('-').map(Number)
  let dates
  if (isAllDay || !time) {
    // All-day events use plain dates and an *exclusive* end date.
    const days = Math.max(1, Math.round((durationMinutes || 1440) / 1440))
    const start = new Date(y, m - 1, d)
    const end = new Date(y, m - 1, d + days)
    dates = `${ymd(start)}/${ymd(end)}`
  } else {
    // Local "floating" times: Google reads them in the calendar's own timezone.
    const [hh, mm] = time.split(':').map(Number)
    const start = new Date(y, m - 1, d, hh, mm)
    const end = new Date(start.getTime() + (durationMinutes || REMINDER_MINUTES) * 60000)
    dates = `${ymdhms(start)}/${ymdhms(end)}`
  }

  const params = new URLSearchParams({ action: 'TEMPLATE', text: title || 'Untitled', dates })
  const details = notesToPlainText(notes)
  if (details) params.set('details', details)
  const rrule = recurrenceToRrule(recurrence)
  if (rrule) params.set('recur', rrule)
  return `${BASE}?${params.toString()}`
}
