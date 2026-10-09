import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../db.js'
import * as repo from '../index.js'
import { runRollover, getDisplayStatus } from '../rollover.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
})

describe('runRollover', () => {
  it('finalizes a past day as completed when percentComplete reached 100', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-17',
      startPercent: 40,
      percentComplete: 100,
    })

    await runRollover('2026-08-19')

    const finalized = await repo.getInstance(inst.id)
    expect(finalized.finalized).toBe(true)
    expect(finalized.status).toBe('completed')
  })

  it('finalizes as worked_on when percent increased but did not reach 100', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-17',
      startPercent: 60,
      percentComplete: 65,
    })

    await runRollover('2026-08-19')

    const finalized = await repo.getInstance(inst.id)
    expect(finalized.status).toBe('worked_on')
  })

  it('finalizes as ghost when percent is unchanged from the start-of-day snapshot', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-17',
      startPercent: 60,
      percentComplete: 60,
    })

    await runRollover('2026-08-19')

    const finalized = await repo.getInstance(inst.id)
    expect(finalized.status).toBe('ghost')
  })

  it('returns a non-recurring, incomplete item to the backlog after finalizing, syncing its percent', async () => {
    const item = await repo.saveItem({ title: 'Task', isUnscheduled: false })
    await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-17',
      startPercent: 60,
      percentComplete: 60,
    })

    await runRollover('2026-08-19')

    const updated = await repo.getItem(item.id)
    expect(updated.isUnscheduled).toBe(true)
    expect(updated.percentComplete).toBe(60)
  })

  it('does not return a recurring item to the backlog even if a day is a ghost', async () => {
    const item = await repo.saveItem({
      title: 'Standup',
      isUnscheduled: false,
      recurrence: { freq: 'daily', interval: 1, byWeekday: null, startDate: '2026-08-17', endDate: null, time: '09:00' },
    })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-17', startPercent: 0, percentComplete: 0 })

    await runRollover('2026-08-19')

    const updated = await repo.getItem(item.id)
    expect(updated.isUnscheduled).toBe(false)
  })

  it('tracks each occurrence of a recurring item independently', async () => {
    const item = await repo.saveItem({
      title: 'Standup',
      isUnscheduled: false,
      recurrence: { freq: 'daily', interval: 1, byWeekday: null, startDate: '2026-08-17', endDate: null, time: '09:00' },
    })
    // Monday's occurrence was completed; Tuesday's was not touched.
    const monday = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-17',
      startPercent: 0,
      percentComplete: 100,
    })
    const tuesday = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-18',
      startPercent: 0,
      percentComplete: 0,
    })

    await runRollover('2026-08-19')

    expect((await repo.getInstance(monday.id)).status).toBe('completed')
    expect((await repo.getInstance(tuesday.id)).status).toBe('ghost')
  })

  it('never finalizes today, only activates its startPercent snapshot', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({ itemId: item.id, date: '2026-08-19', percentComplete: 30 })

    await runRollover('2026-08-19')

    const stillOpen = await repo.getInstance(inst.id)
    expect(stillOpen.finalized).toBe(false)
    expect(stillOpen.startPercent).toBe(30)
  })

  it('handles multi-day catch-up: several unfinalized past days all resolve from the same untouched percent', async () => {
    const item = await repo.saveItem({ title: 'Task', isUnscheduled: false })
    const day1 = await repo.saveInstance({ itemId: item.id, date: '2026-08-15', percentComplete: 20 })
    const day2 = await repo.saveInstance({ itemId: item.id, date: '2026-08-16', percentComplete: 20 })
    const day3 = await repo.saveInstance({ itemId: item.id, date: '2026-08-17', percentComplete: 20 })

    await runRollover('2026-08-19')

    for (const inst of [day1, day2, day3]) {
      const finalized = await repo.getInstance(inst.id)
      expect(finalized.finalized).toBe(true)
      expect(finalized.status).toBe('ghost')
      expect(finalized.startPercent).toBe(20)
    }
  })

  it('is idempotent — running twice does not change an already-finalized instance', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-17',
      startPercent: 0,
      percentComplete: 100,
    })

    await runRollover('2026-08-19')
    const afterFirst = await repo.getInstance(inst.id)

    // Running again (e.g. the next day) must not touch an already-finalized
    // instance — it's locked-in history from here on.
    await runRollover('2026-08-20')
    const afterSecond = await repo.getInstance(inst.id)

    expect(afterSecond).toEqual(afterFirst)
  })
})

describe('getDisplayStatus', () => {
  it('returns the locked-in status for a finalized instance', () => {
    const inst = { finalized: true, status: 'worked_on', startPercent: 10, percentComplete: 55 }
    expect(getDisplayStatus(inst)).toBe('worked_on')
  })

  it('shows completed immediately once percent hits 100, even before finalization', () => {
    const inst = { finalized: false, status: 'pending', startPercent: 10, percentComplete: 100 }
    expect(getDisplayStatus(inst)).toBe('completed')
  })

  it('shows in_progress once percent has moved past the start-of-day snapshot', () => {
    const inst = { finalized: false, status: 'pending', startPercent: 10, percentComplete: 40 }
    expect(getDisplayStatus(inst)).toBe('in_progress')
  })

  it('shows pending when untouched', () => {
    const inst = { finalized: false, status: 'pending', startPercent: 10, percentComplete: 10 }
    expect(getDisplayStatus(inst)).toBe('pending')
  })
})

describe('partial progress is never lost at end of day', () => {
  it('finalizes as worked_on when an instance created with a 0 baseline got partial progress', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    // instances are now created with startPercent 0, so progress added later that day always counts
    const inst = await repo.saveInstance({ itemId: item.id, date: '2026-08-17', startPercent: 0, percentComplete: 40 })

    await runRollover('2026-08-19')

    const finalized = await repo.getInstance(inst.id)
    expect(finalized.status).toBe('worked_on')
  })

  it('still ghosts a day with no progress beyond what was carried in', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({ itemId: item.id, date: '2026-08-17', startPercent: 40, percentComplete: 40 })

    await runRollover('2026-08-19')

    expect((await repo.getInstance(inst.id)).status).toBe('ghost')
  })

  it('shows any progress as in progress even before a baseline exists', () => {
    expect(getDisplayStatus({ finalized: false, percentComplete: 30, startPercent: null })).toBe('in_progress')
    expect(getDisplayStatus({ finalized: false, percentComplete: 0, startPercent: null })).toBe('pending')
  })
})
