import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { computeUnscheduledTime } from '../statsAggregations.js'

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
