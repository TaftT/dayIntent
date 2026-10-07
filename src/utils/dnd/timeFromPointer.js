import { pxToMinutes } from '../../components/dayview/gridConstants.js'
import { roundToTenMinutes, minutesToTimeStr, timeStrToMinutes } from '../dateUtils.js'

/**
 * Maps a click position to the half-hour slot it landed in (rounded down, so
 * a click anywhere in 9:30–10:00 gives 09:30 rather than a guessed minute).
 * @param {number} offsetY pixels from the top of the day grid @returns {string} 'HH:mm' on the hour or half hour
 */
export function pxOffsetToTimeStr(offsetY) {
  const minutes = Math.floor(pxToMinutes(Math.max(0, offsetY)) / 30) * 30
  return minutesToTimeStr(minutes)
}

/**
 * Applies a vertical pixel delta (from a drag) to a starting time string,
 * snapping to 10-minute increments and clamping to stay within the day.
 * @param {string} startTime 'HH:mm'
 * @param {number} deltaY pixels
 * @param {number} durationMinutes used to keep the block from being dragged past midnight
 */
export function applyDeltaToTime(startTime, deltaY, durationMinutes = 0) {
  const startMinutes = timeStrToMinutes(startTime)
  const deltaMinutes = roundToTenMinutes(pxToMinutes(deltaY))
  const maxStart = 24 * 60 - Math.max(durationMinutes, 10)
  const next = Math.max(0, Math.min(maxStart, startMinutes + deltaMinutes))
  return minutesToTimeStr(next)
}
