import { describe, it, expect } from 'vitest'
import { shiftRange } from '../shiftRange.js'

// Wed 2026-10-07; its calendar week is Sun 10-04 .. Sat 10-10
const TODAY = '2026-10-07'

describe('shiftRange', () => {
  it('moves a single day back and forward by one day', () => {
    expect(shiftRange({ from: '2026-10-07', to: '2026-10-07' }, -1, TODAY)).toEqual({ from: '2026-10-06', to: '2026-10-06' })
    expect(shiftRange({ from: '2026-10-05', to: '2026-10-05' }, 1, TODAY)).toEqual({ from: '2026-10-06', to: '2026-10-06' })
  })

  it('cannot go forward from today', () => {
    expect(shiftRange({ from: '2026-10-07', to: '2026-10-07' }, 1, TODAY)).toBeNull()
  })

  it('steps the in-progress week back to the previous full week', () => {
    expect(shiftRange({ from: '2026-10-04', to: '2026-10-07' }, -1, TODAY)).toEqual({ from: '2026-09-27', to: '2026-10-03' })
  })

  it('moves a full week by a week, and forward is capped at today', () => {
    const lastWeek = { from: '2026-09-27', to: '2026-10-03' }
    expect(shiftRange(lastWeek, -1, TODAY)).toEqual({ from: '2026-09-20', to: '2026-09-26' })
    // forward from last week lands on this week, cut off at today
    expect(shiftRange(lastWeek, 1, TODAY)).toEqual({ from: '2026-10-04', to: '2026-10-07' })
  })

  it('moves an N-day range by N days', () => {
    expect(shiftRange({ from: '2026-09-08', to: '2026-10-07' }, -1, TODAY)).toEqual({ from: '2026-08-09', to: '2026-09-07' })
  })
})
