import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../db.js'
import * as repo from '../index.js'
import { getOccurrencesBetween, ensureInstancesGenerated, regenerateFutureInstances, topUpRecurringInstances } from '../recurrence.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
})

describe('getOccurrencesBetween', () => {
  it('daily every N days', () => {
    const rule = { freq: 'daily', interval: 2, byWeekday: null, startDate: '2026-08-01', endDate: null, time: '09:00' }
    const occ = getOccurrencesBetween(rule, '2026-08-01', '2026-08-08')
    expect(occ).toEqual(['2026-08-01', '2026-08-03', '2026-08-05', '2026-08-07'])
  })

  it('weekly on specific weekdays with interval', () => {
    // 2026-08-03 is a Monday
    const rule = {
      freq: 'weekly',
      interval: 2,
      byWeekday: [1, 3], // Mon, Wed
      startDate: '2026-08-03',
      endDate: null,
      time: null,
    }
    const occ = getOccurrencesBetween(rule, '2026-08-03', '2026-08-24')
    // week of 8/3 (included), skip week of 8/10, include week of 8/17
    expect(occ).toEqual(['2026-08-03', '2026-08-05', '2026-08-17', '2026-08-19'])
  })

  it('monthly on the same day-of-month', () => {
    const rule = { freq: 'monthly', interval: 1, byWeekday: null, startDate: '2026-08-15', endDate: null, time: null }
    const occ = getOccurrencesBetween(rule, '2026-08-01', '2026-11-01')
    expect(occ).toEqual(['2026-08-15', '2026-09-15', '2026-10-15'])
  })

  it('respects rule endDate', () => {
    const rule = { freq: 'daily', interval: 1, byWeekday: null, startDate: '2026-08-01', endDate: '2026-08-03', time: null }
    const occ = getOccurrencesBetween(rule, '2026-08-01', '2026-08-10')
    expect(occ).toEqual(['2026-08-01', '2026-08-02', '2026-08-03'])
  })
})

describe('ensureInstancesGenerated', () => {
  it('is idempotent — calling twice does not duplicate instances', async () => {
    const item = await repo.saveItem({
      title: 'Standup',
      isUnscheduled: false,
      recurrence: {
        freq: 'daily',
        interval: 1,
        byWeekday: null,
        startDate: '2026-08-19',
        endDate: '2026-08-21',
        time: '09:00',
      },
    })

    await ensureInstancesGenerated(item, '2026-08-19', 5)
    await ensureInstancesGenerated(item, '2026-08-19', 5)

    const instances = await repo.getInstancesForItem(item.id)
    expect(instances).toHaveLength(3)
  })
})

describe('regenerateFutureInstances', () => {
  it('leaves finalized instances alone and regenerates the rest', async () => {
    const item = await repo.saveItem({
      title: 'Standup',
      isUnscheduled: false,
      recurrence: {
        freq: 'daily',
        interval: 1,
        byWeekday: null,
        startDate: '2026-08-17',
        endDate: '2026-08-21',
        time: '09:00',
      },
    })
    await ensureInstancesGenerated(item, '2026-08-17', 10)

    const before = await repo.getInstancesForItem(item.id)
    const pastInst = before.find((i) => i.date === '2026-08-17')
    await repo.saveInstance({ ...pastInst, finalized: true, status: 'completed' })

    const updatedItem = await repo.saveItem({ id: item.id, durationMinutes: 45 })
    await regenerateFutureInstances(updatedItem, '2026-08-18')

    const after = await repo.getInstancesForItem(item.id)
    const stillFinalized = after.find((i) => i.date === '2026-08-17')
    expect(stillFinalized.finalized).toBe(true)

    const regenerated = after.find((i) => i.date === '2026-08-19')
    expect(regenerated.durationMinutes).toBe(45)
  })
})

describe('topUpRecurringInstances', () => {
  const daily = { freq: 'daily', interval: 1, byWeekday: null, startDate: '2026-01-01', endDate: null, time: '09:00' }
  const mkItem = (over = {}) => repo.saveItem({ title: 'Daily', durationMinutes: 30, recurrence: daily, isUnscheduled: false, ...over })

  it('keeps a series that ran dry generating, without inventing missed past days', async () => {
    const item = await mkItem()
    await ensureInstancesGenerated(item, '2026-01-01') // runs out ~60 days later
    const before = await repo.getInstancesForItem(item.id)
    expect(before.map((i) => i.date).sort().at(-1)).toBe('2026-03-02')

    const created = await topUpRecurringInstances([item], '2026-06-01') // months later
    const after = await repo.getInstancesForItem(item.id)
    const dates = after.map((i) => i.date).sort()
    expect(created).toBe(61) // 2026-06-01 .. 2026-07-31
    expect(dates).not.toContain('2026-04-15') // the quiet gap stays empty
    expect(dates.at(-1)).toBe('2026-07-31')
  })

  it('is idempotent and extends one day at a time as time passes', async () => {
    const item = await mkItem()
    await ensureInstancesGenerated(item, '2026-01-01')
    expect(await topUpRecurringInstances([item], '2026-01-01')).toBe(0)
    expect(await topUpRecurringInstances([item], '2026-01-02')).toBe(1)
    expect(await topUpRecurringInstances([item], '2026-01-02')).toBe(0)
  })

  it('does not bring back an occurrence that was deleted or moved', async () => {
    const item = await mkItem()
    await ensureInstancesGenerated(item, '2026-01-01')
    const [, second] = (await repo.getInstancesForItem(item.id)).sort((a, b) => a.date.localeCompare(b.date))
    await repo.deleteInstance(second.id)
    await topUpRecurringInstances([item], '2026-01-05')
    expect((await repo.getInstancesForItem(item.id)).map((i) => i.date)).not.toContain(second.date)
  })

  it('uses the same ids on every device, so syncing two top-ups can’t duplicate', async () => {
    const item = await mkItem()
    await topUpRecurringInstances([item], '2026-01-01')
    const ids = (await repo.getInstancesForItem(item.id)).map((i) => i.id)
    expect(ids).toContain(`${item.id}_2026-01-01`)
    await topUpRecurringInstances([item], '2026-01-01') // a second device, same moment
    expect((await repo.getInstancesForItem(item.id)).length).toBe(ids.length)
  })

  it('respects the end date and skips archived or non-recurring items', async () => {
    const ending = await mkItem({ recurrence: { ...daily, endDate: '2026-01-10' } })
    const plain = await repo.saveItem({ title: 'Once', durationMinutes: 30 })
    const archived = await mkItem({ archived: true })
    await topUpRecurringInstances([ending, plain, archived], '2026-01-01')
    expect((await repo.getInstancesForItem(ending.id)).length).toBe(10)
    expect(await repo.getInstancesForItem(plain.id)).toHaveLength(0)
    expect(await repo.getInstancesForItem(archived.id)).toHaveLength(0)
  })

  it('keeps the window bounded however long it runs', async () => {
    const item = await mkItem()
    for (let d = 0; d < 400; d++) {
      const today = new Date(Date.UTC(2026, 0, 1 + d)).toISOString().slice(0, 10)
      await topUpRecurringInstances([item], today)
    }
    // one per day since the start, but never more than the window ahead of "today"
    const dates = (await repo.getInstancesForItem(item.id)).map((i) => i.date).sort()
    expect(dates.at(-1)).toBe('2027-04-05')
  })
})
