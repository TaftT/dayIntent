import { addDaysStr } from './dateUtils.js'

// A day's mood is two running tallies per person: every good thing is a +1
// tap, every bad thing a -1 tap. The day's score is positives minus negatives,
// so 10 good and 4 bad is +6 (a positive day) and 2 good and 5 bad is -3.
//
// Stored on the day's journal entry as
//   moodTally: { me: { pos, neg }, others: { pos, neg } }

export const MOOD_PEOPLE = ['me', 'others']

const emptySide = () => ({ pos: 0, neg: 0 })

export function emptyTally() {
  return { me: emptySide(), others: emptySide() }
}

/** The tally for a journal entry, always fully shaped (missing parts are zero). */
export function readTally(journal) {
  const t = journal?.moodTally
  const side = (s) => ({ pos: Math.max(0, s?.pos ?? 0), neg: Math.max(0, s?.neg ?? 0) })
  return { me: side(t?.me), others: side(t?.others) }
}

/** @returns {number} positives minus negatives */
export const sideScore = (side) => side.pos - side.neg

/** True once anything has been tapped for this person. */
export const sideLogged = (side) => side.pos + side.neg > 0

/**
 * A new tally with one count moved by `delta` (clamped at zero).
 * @param {'me'|'others'} who
 * @param {'pos'|'neg'} kind
 */
export function adjustTally(tally, who, kind, delta) {
  const base = readTally({ moodTally: tally })
  return { ...base, [who]: { ...base[who], [kind]: Math.max(0, base[who][kind] + delta) } }
}

/** "+6", "−3" or "0" — with a real minus sign so it reads clearly. */
export function formatScore(score) {
  if (score > 0) return `+${score}`
  if (score < 0) return `−${Math.abs(score)}`
  return '0'
}

/** True when a journal entry has any mood tapped for either person. */
export function hasTally(journal) {
  const t = readTally(journal)
  return sideLogged(t.me) || sideLogged(t.others)
}

/**
 * Per-day score and summary for one person over a date range. Days where
 * nothing was tapped are kept in `days` (score: null) so a chart can show the
 * gap, but don't count toward the average or the positive/negative totals.
 *
 * @param {import('../data/types.js').DayJournal[]} journals
 * @param {'me'|'others'} who
 * @param {string} fromDate 'YYYY-MM-DD' inclusive
 * @param {string} toDate 'YYYY-MM-DD' inclusive
 */
export function computeMoodStats(journals, who, fromDate, toDate) {
  const [from, to] = fromDate <= toDate ? [fromDate, toDate] : [toDate, fromDate]
  const byDate = new Map()
  for (const j of journals) {
    if (j.date < from || j.date > to) continue
    const side = readTally(j)[who]
    if (sideLogged(side)) byDate.set(j.date, sideScore(side))
  }

  const days = []
  for (let d = from; d <= to; d = addDaysStr(d, 1)) {
    days.push({ date: d, score: byDate.has(d) ? byDate.get(d) : null })
    if (days.length > 1000) break
  }

  const logged = days.filter((d) => d.score != null)
  const total = logged.reduce((sum, d) => sum + d.score, 0)
  return {
    days,
    loggedDays: logged.length,
    positiveDays: logged.filter((d) => d.score > 0).length,
    negativeDays: logged.filter((d) => d.score < 0).length,
    average: logged.length === 0 ? 0 : Math.round((total / logged.length) * 10) / 10,
    best: logged.length === 0 ? null : logged.reduce((a, b) => (b.score > a.score ? b : a)),
    worst: logged.length === 0 ? null : logged.reduce((a, b) => (b.score < a.score ? b : a)),
  }
}
