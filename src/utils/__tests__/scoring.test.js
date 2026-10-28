import { describe, it, expect } from 'vitest'
import {
  DEFAULT_SCORING as S,
  completionReward,
  computeScore,
  moveDistanceMinutes,
  movePenalty,
  wasPlanned,
} from '../scoring.js'

// Created the evening before, so it counts as planned ahead.
const planned = (over) => ({
  id: 'i',
  date: '2026-10-10',
  time: '09:00',
  durationMinutes: 60,
  percentComplete: 100,
  createdAt: new Date(2026, 9, 9, 20, 0).toISOString(),
  moves: [],
  ...over,
})

describe('scoring', () => {
  it('measures a move across days and times', () => {
    expect(moveDistanceMinutes('2026-10-10', '09:00', '2026-10-10', '10:30')).toBe(90)
    expect(moveDistanceMinutes('2026-10-10', '09:00', '2026-10-11', '09:00')).toBe(1440)
    expect(moveDistanceMinutes('2026-10-10', '09:00', '2026-10-09', '21:00')).toBe(720)
  })

  it('docks bigger moves more, capped, and locked moves several times more', () => {
    const small = movePenalty({ minutes: 30, locked: false }, S)
    const big = movePenalty({ minutes: 240, locked: false }, S)
    expect(big).toBeGreaterThan(small)
    expect(movePenalty({ minutes: 100000, locked: false }, S)).toBe(S.maxPenaltyPerMove)
    expect(movePenalty({ minutes: 30, locked: true }, S)).toBeCloseTo(small * S.lockedMultiplier, 0)
  })

  it('scales the reward with length, within bounds', () => {
    expect(completionReward(60, S)).toBe(10)
    expect(completionReward(10, S)).toBe(5)
    expect(completionReward(600, S)).toBe(30)
  })

  it('only counts items scheduled before they started', () => {
    expect(wasPlanned(planned())).toBe(true)
    expect(wasPlanned(planned({ createdAt: new Date(2026, 9, 10, 9, 30).toISOString() }))).toBe(false)
  })

  it('totals earnings minus move costs, ignoring unplanned and unfinished items', () => {
    const moved = planned({ id: 'm', moves: [{ at: new Date(2026, 9, 9, 21, 0).toISOString(), minutes: 120, locked: false }] })
    const r = computeScore(
      [
        planned({ id: 'clean' }),
        moved,
        planned({ id: 'logged', createdAt: new Date(2026, 9, 10, 12, 0).toISOString() }),
        planned({ id: 'open', percentComplete: 0 }),
      ],
      S,
      '2026-10-01',
      '2026-10-31',
    )
    const cost = movePenalty({ minutes: 120, locked: false }, S)
    expect(r.completed).toBe(2)
    expect(r.completedClean).toBe(1)
    expect(r.earned).toBe(20)
    expect(r.dockedMoves).toBe(cost)
    expect(r.total).toBe(20 - cost)
  })

  it('still docks a move on an item that never gets done, and tracks locked moves', () => {
    const r = computeScore(
      [planned({ percentComplete: 0, moves: [{ at: new Date(2026, 9, 9, 21, 0).toISOString(), minutes: 60, locked: true }] })],
      S,
      '2026-10-01',
      '2026-10-31',
    )
    expect(r.earned).toBe(0)
    expect(r.lockedMoveCount).toBe(1)
    expect(r.total).toBe(-r.dockedLocked)
    expect(r.total).toBeLessThan(0)
  })
})
