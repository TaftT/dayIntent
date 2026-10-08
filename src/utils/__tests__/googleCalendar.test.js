import { describe, it, expect } from 'vitest'
import { buildGoogleCalendarUrl, recurrenceToRrule, notesToPlainText } from '../googleCalendar.js'

const params = (url) => Object.fromEntries(new URL(url).searchParams)

describe('buildGoogleCalendarUrl', () => {
  it('builds a timed event with local start/end', () => {
    const p = params(
      buildGoogleCalendarUrl({ title: 'Dentist', date: '2026-10-12', time: '14:30', durationMinutes: 45 })
    )
    expect(p).toMatchObject({ action: 'TEMPLATE', text: 'Dentist', dates: '20261012T143000/20261012T151500' })
  })

  it('rolls an overnight event into the next day', () => {
    const p = params(buildGoogleCalendarUrl({ title: 'Sleep', date: '2026-10-12', time: '23:00', durationMinutes: 480 }))
    expect(p.dates).toBe('20261012T230000/20261013T070000')
  })

  it('uses plain dates and an exclusive end for all-day events', () => {
    const one = params(buildGoogleCalendarUrl({ title: 'Trip', date: '2026-10-12', isAllDay: true, durationMinutes: 1440 }))
    expect(one.dates).toBe('20261012/20261013')
    const three = params(buildGoogleCalendarUrl({ title: 'Trip', date: '2026-10-30', isAllDay: true, durationMinutes: 4320 }))
    expect(three.dates).toBe('20261030/20261102')
  })

  it('gives a task with no duration a short slot', () => {
    const p = params(buildGoogleCalendarUrl({ title: 'Call', date: '2026-10-12', time: '09:00', durationMinutes: null }))
    expect(p.dates).toBe('20261012T090000/20261012T091500')
  })

  it('includes notes as plain text and a recurrence rule when present', () => {
    const p = params(
      buildGoogleCalendarUrl({
        title: 'Gym',
        notes: '<p>Bring <b>towel</b></p><p>Leg day</p>',
        date: '2026-10-12',
        time: '07:00',
        durationMinutes: 60,
        recurrence: { freq: 'weekly', interval: 1, byWeekday: [3, 1], endDate: '2026-12-31' },
      })
    )
    expect(p.details).toBe('Bring towel\nLeg day')
    expect(p.recur).toBe('RRULE:FREQ=WEEKLY;BYDAY=MO,WE;UNTIL=20261231')
  })

  it('falls back to a title when empty', () => {
    expect(params(buildGoogleCalendarUrl({ title: '', date: '2026-10-12', isAllDay: true })).text).toBe('Untitled')
  })
})

describe('helpers', () => {
  it('maps recurrence frequencies and intervals', () => {
    expect(recurrenceToRrule({ freq: 'daily', interval: 2 })).toBe('RRULE:FREQ=DAILY;INTERVAL=2')
    expect(recurrenceToRrule({ freq: 'monthly', interval: 1 })).toBe('RRULE:FREQ=MONTHLY')
    expect(recurrenceToRrule(null)).toBeNull()
  })

  it('strips markup and entities from notes', () => {
    expect(notesToPlainText('a&nbsp;b<br>c &amp; d')).toBe('a b\nc & d')
    expect(notesToPlainText(null)).toBe('')
  })
})
