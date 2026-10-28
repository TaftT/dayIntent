import { describe, it, expect } from 'vitest'
import { adjustTally, computeMoodStats, formatScore, hasTally, readTally, sideScore } from '../moodTally.js'

describe('mood tally', () => {
  it('scores a day as positives minus negatives', () => {
    expect(sideScore({ pos: 10, neg: 4 })).toBe(6)
    expect(sideScore({ pos: 2, neg: 5 })).toBe(-3)
  })

  it('adjusts one count without touching the others, never below zero', () => {
    let t = adjustTally(undefined, 'me', 'pos', 1)
    t = adjustTally(t, 'me', 'neg', 1)
    t = adjustTally(t, 'others', 'neg', 1)
    expect(t).toEqual({ me: { pos: 1, neg: 1 }, others: { pos: 0, neg: 1 } })
    expect(adjustTally(t, 'others', 'pos', -1).others.pos).toBe(0)
  })

  it('reads a missing tally as all zeros', () => {
    expect(readTally(null)).toEqual({ me: { pos: 0, neg: 0 }, others: { pos: 0, neg: 0 } })
    expect(hasTally({ date: 'x' })).toBe(false)
    expect(hasTally({ moodTally: { me: { pos: 1, neg: 0 } } })).toBe(true)
  })

  it('formats scores with a sign', () => {
    expect(formatScore(6)).toBe('+6')
    expect(formatScore(-3)).toBe('−3')
    expect(formatScore(0)).toBe('0')
  })

  it('summarizes a range, leaving untapped days out of the stats', () => {
    const journals = [
      { date: '2026-10-01', moodTally: { me: { pos: 10, neg: 4 } } }, // +6
      { date: '2026-10-02', moodTally: { me: { pos: 2, neg: 5 } } }, // -3
      { date: '2026-10-04', moodTally: { others: { pos: 1, neg: 0 } } }, // not "me"
      { date: '2026-10-09', moodTally: { me: { pos: 9, neg: 0 } } }, // out of range
    ]
    const s = computeMoodStats(journals, 'me', '2026-10-01', '2026-10-04')
    expect(s.days.map((d) => d.score)).toEqual([6, -3, null, null])
    expect(s).toMatchObject({ loggedDays: 2, positiveDays: 1, negativeDays: 1, average: 1.5 })
    expect(s.best.date).toBe('2026-10-01')
    expect(s.worst.date).toBe('2026-10-02')
  })
})
