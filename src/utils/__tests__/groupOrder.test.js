import { describe, it, expect } from 'vitest'
import { reorderWithinGroup } from '../groupOrder.js'

describe('reorderWithinGroup', () => {
  it('reorders group members without moving tasks from other groups', () => {
    // global priority: 1 (A), 3 (B), 2 (A)
    const order = ['t1', 't3', 't2']
    expect(reorderWithinGroup(order, ['t1', 't2'], 't2', 't1', 'before')).toEqual(['t2', 't3', 't1'])
  })

  it('supports dropping after the target', () => {
    const order = ['a', 'x', 'b', 'y', 'c']
    // group = a, b, c ; move a after b
    expect(reorderWithinGroup(order, ['a', 'b', 'c'], 'a', 'b', 'after')).toEqual(['b', 'x', 'a', 'y', 'c'])
  })

  it('ignores moves across groups or onto itself', () => {
    const order = ['a', 'b', 'c']
    expect(reorderWithinGroup(order, ['a', 'b'], 'a', 'c', 'before')).toBe(order)
    expect(reorderWithinGroup(order, ['a', 'b'], 'a', 'a', 'before')).toBe(order)
  })
})
