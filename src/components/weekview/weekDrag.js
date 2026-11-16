import { minutesToTimeStr, roundToTenMinutes, timeStrToMinutes } from '../../utils/dateUtils.js'

/**
 * Time of day a dragged week-view block lands on: its start time shifted by the
 * vertical drag distance, snapped to 10 minutes and kept inside the day.
 * @param {string} startTime 'HH:mm'
 * @param {number} deltaY drag distance in px
 * @param {number} pxPerMinute the week grid's vertical scale
 * @param {number} durationMinutes keeps the block from being dragged past midnight
 */
export function weekTimeAfterDrag(startTime, deltaY, pxPerMinute, durationMinutes = 0) {
  const shifted = timeStrToMinutes(startTime) + roundToTenMinutes(deltaY / pxPerMinute)
  const latestStart = 24 * 60 - Math.max(durationMinutes, 10)
  return minutesToTimeStr(Math.max(0, Math.min(latestStart, shifted)))
}
