import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ items: [], allInstances: [], instancesByDate: {}, categories: [], groups: [] })
})

const store = () => useEntityStore.getState()

// A daily series with an occurrence on each of 5 days, the first two already finalized history.
async function seedSeries() {
  const work = await repo.saveCategory({ name: 'Work', color: '#111111' })
  const item = await repo.saveItem({
    title: 'Standup',
    durationMinutes: 30,
    categoryId: work.id,
    isUnscheduled: false,
    recurrence: { freq: 'daily', interval: 1, byWeekday: null, startDate: '2026-10-01', endDate: null, time: '09:00' },
  })
  const dates = ['2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04', '2026-10-05']
  for (const [i, date] of dates.entries()) {
    await repo.saveInstance({
      itemId: item.id,
      date,
      time: '09:00',
      durationMinutes: 30,
      finalized: i < 2,
      status: i < 2 ? 'completed' : 'pending',
      percentComplete: i < 2 ? 100 : 0,
    })
  }
  const other = await repo.saveCategory({ name: 'Home', color: '#222222' })
  return { item, work, other }
}

describe('splitSeriesFrom ("this & future")', () => {
  it('changes the category from the chosen date on and leaves earlier events alone', async () => {
    const { item, work, other } = await seedSeries()
    const created = await store().splitSeriesFrom(item.id, '2026-10-03', { categoryId: other.id })

    const oldItem = await repo.getItem(item.id)
    expect(oldItem.categoryId).toBe(work.id)
    expect(oldItem.recurrence.endDate).toBe('2026-10-02') // capped the day before
    expect(created.categoryId).toBe(other.id)
    expect(created.recurrence.startDate).toBe('2026-10-03')

    const all = await repo.getAllInstances()
    const byDate = Object.fromEntries(all.map((i) => [i.date, i.itemId]))
    expect(byDate['2026-10-01']).toBe(item.id)
    expect(byDate['2026-10-02']).toBe(item.id)
    expect(byDate['2026-10-03']).toBe(created.id)
    expect(byDate['2026-10-05']).toBe(created.id)
  })

  it('carries the progress of moved occurrences and pushes a new duration onto them', async () => {
    const { item } = await seedSeries()
    const created = await store().splitSeriesFrom(item.id, '2026-10-03', { durationMinutes: 60 })
    const moved = (await repo.getAllInstances()).filter((i) => i.itemId === created.id)
    expect(moved).toHaveLength(3)
    expect(moved.every((i) => i.durationMinutes === 60)).toBe(true)
    // history is untouched
    const history = (await repo.getAllInstances()).filter((i) => i.itemId === item.id)
    expect(history.every((i) => i.durationMinutes === 30 && i.finalized)).toBe(true)
  })

  it('is a plain update when the date is the first day of the series', async () => {
    const { item, other } = await seedSeries()
    const result = await store().splitSeriesFrom(item.id, '2026-10-01', { categoryId: other.id })
    expect(result.id).toBe(item.id)
    expect((await repo.getAllItems()).length).toBe(1)
  })
})
