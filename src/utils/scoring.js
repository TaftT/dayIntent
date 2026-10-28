import { addDaysStr, timeStrToMinutes, toDateStr } from './dateUtils.js'

// Planner score. Completing something you planned earns points; moving a
// scheduled item costs points, more the further it moves, and a lot more if it
// was locked. Everything is derived from facts stored on each instance
// (`moves`, `locked`, completion) plus these tunable settings, so changing a
// setting re-scores history rather than leaving old numbers frozen.
//
// instance.moves: [{ at: ISO time of the move, minutes: distance moved, locked: was it locked }]

export const DEFAULT_SCORING = {
  completionPoints: 10, // for finishing a planned 1-hour item (scaled by length)
  movePenaltyBase: 1, // any move at all
  movePenaltyPerHour: 0.5, // extra per hour of distance moved
  maxPenaltyPerMove: 10, // cap before the locked multiplier
  lockedMultiplier: 3, // a locked item's moves cost this many times more
  graceMinutes: 5, // moves within this long of first scheduling are free
}

export const MINUTES_PER_DAY = 1440

const round1 = (n) => Math.round(n * 10) / 10

function startMinutes(date, time) {
  const [y, m, d] = date.split('-').map(Number)
  const days = Math.round(Date.UTC(y, m - 1, d) / 86400000)
  return days * MINUTES_PER_DAY + (time ? timeStrToMinutes(time) : 0)
}

/** How far a move shifted an item, in minutes (always positive). */
export function moveDistanceMinutes(oldDate, oldTime, newDate, newTime) {
  return Math.abs(startMinutes(newDate, newTime) - startMinutes(oldDate, oldTime))
}

/** Points a single move costs (positive number). */
export function movePenalty(move, settings = DEFAULT_SCORING) {
  const raw = settings.movePenaltyBase + settings.movePenaltyPerHour * (move.minutes / 60)
  const capped = Math.min(raw, settings.maxPenaltyPerMove)
  return round1(move.locked ? capped * settings.lockedMultiplier : capped)
}

/** Points for completing an item of this length (null = a reminder). */
export function completionReward(durationMinutes, settings = DEFAULT_SCORING) {
  const hours = durationMinutes == null ? 0.5 : durationMinutes / 60
  return round1(settings.completionPoints * Math.min(3, Math.max(0.5, hours)))
}

/**
 * Whether an occurrence was planned ahead (scheduled before it started) as
 * opposed to logged after the fact. Only planned ones earn points — otherwise
 * "log what I just did" would be free score.
 */
export function wasPlanned(instance) {
  if (!instance.createdAt) return false
  const created = new Date(instance.createdAt)
  if (instance.isAllDay || !instance.time) return toDateStr(created) <= instance.date
  const [y, m, d] = instance.date.split('-').map(Number)
  const [hh, mm] = instance.time.split(':').map(Number)
  return created < new Date(y, m - 1, d, hh, mm)
}

const isDone = (inst) => (inst.percentComplete ?? 0) >= 100

/**
 * Score over a date range. Earned points land on the occurrence's date;
 * move costs land on the day the move happened.
 *
 * @param {import('../data/types.js').ScheduledInstance[]} instances
 * @param {typeof DEFAULT_SCORING} settings
 * @param {string} fromDate 'YYYY-MM-DD' inclusive
 * @param {string} toDate 'YYYY-MM-DD' inclusive
 */
export function computeScore(instances, settings, fromDate, toDate) {
  const [from, to] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
  const perDay = new Map()
  const bump = (date, amount) => perDay.set(date, (perDay.get(date) ?? 0) + amount)

  let earned = 0
  let dockedMoves = 0
  let dockedLocked = 0
  let completed = 0
  let completedClean = 0
  let moveCount = 0
  let lockedMoveCount = 0

  for (const inst of instances) {
    if (inst.date >= from && inst.date <= to && isDone(inst) && wasPlanned(inst)) {
      const reward = completionReward(inst.durationMinutes, settings)
      earned += reward
      completed += 1
      if (!(inst.moves?.length > 0)) completedClean += 1
      bump(inst.date, reward)
    }
    for (const move of inst.moves ?? []) {
      const day = toDateStr(new Date(move.at))
      if (day < from || day > to) continue
      const cost = movePenalty(move, settings)
      moveCount += 1
      if (move.locked) {
        dockedLocked += cost
        lockedMoveCount += 1
      } else {
        dockedMoves += cost
      }
      bump(day, -cost)
    }
  }

  const days = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    days.push({ date: d, points: round1(perDay.get(d) ?? 0) })
    if (days.length > 1000) break
  }

  return {
    earned: round1(earned),
    dockedMoves: round1(dockedMoves),
    dockedLocked: round1(dockedLocked),
    total: round1(earned - dockedMoves - dockedLocked),
    completed,
    completedClean,
    moveCount,
    lockedMoveCount,
    days,
  }
}
