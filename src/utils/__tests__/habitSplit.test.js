import { describe, it, expect } from 'vitest'
import { getVisibleHabits, getHabitPredecessors } from '../habitStats.js'

const habit = (id, title, startDate, endDate = null) => ({
  id,
  title,
  isHabit: true,
  recurrence: { freq: 'daily', interval: 1, startDate, endDate },
})

describe('split habits', () => {
  const oldHalf = habit('a', 'Run', '2026-01-01', '2026-10-09')
  const newHalf = habit('b', 'Run daily', '2026-10-10')
  const other = habit('c', 'Read', '2026-02-01')

  it('shows one card for a capped half and its continuation', () => {
    expect(getVisibleHabits([oldHalf, newHalf, other]).map((h) => h.id)).toEqual(['b', 'c'])
    expect(getHabitPredecessors(newHalf, [oldHalf, newHalf, other]).map((h) => h.id)).toEqual(['a'])
  })

  it('leaves unrelated habits alone', () => {
    expect(getVisibleHabits([oldHalf, other]).map((h) => h.id)).toEqual(['a', 'c'])
  })
})
