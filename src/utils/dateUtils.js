import { format, parseISO, addDays, isSameDay, startOfWeek } from 'date-fns'

export const DATE_FMT = 'yyyy-MM-dd'

/** @returns {string} today's date as 'YYYY-MM-DD' in local time */
export function todayStr() {
  return format(new Date(), DATE_FMT)
}

/** @param {Date} date @returns {string} */
export function toDateStr(date) {
  return format(date, DATE_FMT)
}

/** @param {string} dateStr 'YYYY-MM-DD' @returns {Date} */
export function fromDateStr(dateStr) {
  return parseISO(dateStr)
}

/** @param {string} dateStr @param {number} n @returns {string} */
export function addDaysStr(dateStr, n) {
  return toDateStr(addDays(fromDateStr(dateStr), n))
}

/** @returns {{from: string, to: string}} the current calendar week so far: this Sunday through today */
export function currentWeekRange() {
  const now = new Date()
  return {
    from: toDateStr(startOfWeek(now, { weekStartsOn: 0 })),
    to: toDateStr(now),
  }
}

/** @param {string} a @param {string} b */
export function isSameDateStr(a, b) {
  return a === b
}

export function isPastDateStr(dateStr, todayDateStr) {
  return dateStr < todayDateStr
}

/** @param {string} timeStr 'HH:mm' @returns {number} minutes since midnight */
export function timeStrToMinutes(timeStr) {
  if (!timeStr) return 0
  const [h, m] = timeStr.split(':').map(Number)
  return h * 60 + m
}

/** @param {number} minutes @returns {string} 'HH:mm' */
export function minutesToTimeStr(minutes) {
  const clamped = Math.max(0, Math.min(23 * 60 + 59, minutes))
  const h = Math.floor(clamped / 60)
  const m = clamped % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}

/** @param {number} minutes @returns {string} rounds down to nearest 10-minute increment */
export function roundToTenMinutes(minutes) {
  return Math.round(minutes / 10) * 10
}

/** @param {string} timeStr 'HH:mm' @returns {string} e.g. '6 PM', '6:30 PM' */
export function formatTimeLabel(timeStr) {
  if (!timeStr) return ''
  const minutes = timeStrToMinutes(timeStr)
  const h24 = Math.floor(minutes / 60)
  const m = minutes % 60
  const period = h24 >= 12 ? 'PM' : 'AM'
  let h12 = h24 % 12
  if (h12 === 0) h12 = 12
  return m === 0 ? `${h12} ${period}` : `${h12}:${String(m).padStart(2, '0')} ${period}`
}

/** @param {string} dateStr @returns {string} e.g. 'Tuesday, August 19' */
export function formatDayHeading(dateStr) {
  return format(fromDateStr(dateStr), 'EEEE, MMMM d')
}

export function isTodayStr(dateStr) {
  return isSameDay(fromDateStr(dateStr), new Date())
}

/** @param {string} dateStr @returns {string} e.g. 'Aug 19' */
export function formatShortDate(dateStr) {
  return format(fromDateStr(dateStr), 'MMM d')
}

/** @param {number} minutes @returns {string} e.g. '3h 20m', '45m', '2h', '0m' */
export function formatMinutesShort(minutes) {
  const total = Math.max(0, Math.round(minutes || 0))
  const h = Math.floor(total / 60)
  const m = total % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
