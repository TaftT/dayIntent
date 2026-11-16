import { describe, it, expect } from 'vitest'
import { weekTimeAfterDrag } from '../weekDrag.js'

const PX_PER_MIN = 52 / 60

describe('weekTimeAfterDrag', () => {
  it('moves by the dragged distance, snapped to 10 minutes', () => {
    expect(weekTimeAfterDrag('09:00', 52, PX_PER_MIN, 60)).toBe('10:00') // one hour down
    expect(weekTimeAfterDrag('09:00', -52, PX_PER_MIN, 60)).toBe('08:00')
    expect(weekTimeAfterDrag('09:00', 12, PX_PER_MIN, 60)).toBe('09:10') // ~14 min -> 10
  })
  it('stays inside the day', () => {
    expect(weekTimeAfterDrag('00:30', -500, PX_PER_MIN, 60)).toBe('00:00')
    expect(weekTimeAfterDrag('22:00', 500, PX_PER_MIN, 60)).toBe('23:00') // latest start for a 60 min block
  })
})
