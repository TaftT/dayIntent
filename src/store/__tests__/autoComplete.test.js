import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'
import { todayStr, addDaysStr } from '../../utils/dateUtils.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ items: [], allInstances: [], instancesByDate: {}, categories: [], groups: [] })
  vi.useFakeTimers({ toFake: ['Date'] }) // only the clock: faking timers would stall IndexedDB
  vi.setSystemTime(new Date(2026, 9, 9, 15, 0)) // Fri 2026-10-09, 3:00 pm
})
afterEach(() => vi.useRealTimers())

const schedule = async (date, opts) => {
  const item = await repo.saveItem({ title: 'Task', durationMinutes: 30 })
  const inst = await useEntityStore.getState().scheduleItemOnDate(item.id, date, opts)
  return inst.percentComplete
}

describe('auto-complete when scheduling into the past', () => {
  it('completes a task given an earlier time today', async () => {
    expect(await schedule('2026-10-09', { time: '09:00' })).toBe(100)
  })

  it('does not complete one at a later time today', async () => {
    expect(await schedule('2026-10-09', { time: '17:00' })).toBe(0)
  })

  it('does not complete a backlog task dropped on today at the default noon', async () => {
    // same moment as above (3 pm), no explicit time => lands at the default 12:00
    expect(await schedule('2026-10-09', {})).toBe(0)
  })

  it('still completes anything on an earlier day, with or without a time', async () => {
    expect(await schedule(addDaysStr(todayStr(), -1), {})).toBe(100)
    expect(await schedule('2026-10-01', { time: '20:00' })).toBe(100)
  })

  it('leaves future days alone', async () => {
    expect(await schedule('2026-10-12', { time: '09:00' })).toBe(0)
  })
})
