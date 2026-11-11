import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeCategoryTime, computeUnscheduledTime } from '../statsAggregations.js'

const sleepCategory = { id: 'cat-sleep', name: 'Sleep', color: '#000' }
const sleepItem = { id: 'item-sleep', title: 'Sleep', categoryId: 'cat-sleep' }

const sleep = (date, time, durationMinutes) => ({
  id: `${date}-${time}`,
  itemId: 'item-sleep',
  date,
  time,
  durationMinutes,
  isAllDay: false,
})

describe('computeCategoryTime overlaps', () => {
  const cats = [{ id: 'c', name: 'Work', color: '#111' }]
  const items = [{ id: 'i', categoryId: 'c' }]
  const task = (id, time, durationMinutes, extra = {}) => ({
    id, itemId: 'i', date: '2026-10-01', time, durationMinutes,
    finalized: true, status: 'completed', ...extra,
  })
  const total = (insts) =>
    computeCategoryTime(insts, items, cats, '2026-10-01', '2026-10-01').totalMinutes

  it('does not double count a task contained in a longer one', () => {
    expect(total([task('a', '09:00', 120), task('b', '09:30', 60)])).toBe(120)
  })

  it('handles partial overlap', () => {
    // 09:00-11:00 and 10:30-11:30 share 30 minutes => 3.5h - 0.5h = 3h
    expect(total([task('a', '09:00', 120), task('b', '10:30', 60)])).toBe(150)
  })

  it('ignores untimed and all-day tasks', () => {
    expect(
      total([task('a', '09:00', 60), task('b', null, 60), task('c', '00:00', 60, { isAllDay: true })])
    ).toBe(60)
  })

  it('leaves non-overlapping tasks alone', () => {
    expect(total([task('a', '09:00', 60), task('b', '10:00', 60)])).toBe(120)
  })

  it('scales the loss by how much of the longer task was done', () => {
    const big = task('a', '09:00', 120, { status: 'worked_on', finalPercent: 50 })
    expect(total([big, task('b', '09:00', 60)])).toBe(60 + 30)
  })
})

describe('computeUnscheduledTime waking hours', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date(2026, 9, 7, 11, 0)) // Wed 2026-10-07, 11:00
  })
  afterEach(() => vi.useRealTimers())

  it("subtracts the part of last night's sleep that runs into today", () => {
    // 11pm–6am: 6h of it lands on 10-07, so 11:00 now => 11h elapsed - 6h sleep = 5h waking
    const instances = [sleep('2026-10-06', '23:00', 7 * 60)]
    const r = computeUnscheduledTime(instances, [sleepItem], [sleepCategory], [], '2026-10-07', '2026-10-07')
    expect(r.wakingMinutes).toBe(5 * 60)
    expect(r.downtimeMinutes).toBe(5 * 60)
  })

  it('ignores time that has not happened yet', () => {
    const instances = [sleep('2026-10-07', '23:00', 8 * 60)]
    const r = computeUnscheduledTime(instances, [sleepItem], [sleepCategory], [], '2026-10-07', '2026-10-09')
    expect(r.wakingMinutes).toBe(11 * 60)
  })

  it('counts full past days', () => {
    const r = computeUnscheduledTime([], [], [], [], '2026-10-05', '2026-10-06')
    expect(r.wakingMinutes).toBe(2 * 1440)
  })
})
