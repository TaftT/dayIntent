import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore, LockedInstanceError } from '../useEntityStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  localStorage.clear()
  useEntityStore.setState({ items: [], allInstances: [], instancesByDate: {} })
})

const store = () => useEntityStore.getState()
const hourAgo = () => new Date(Date.now() - 3600 * 1000).toISOString()

async function scheduled(over = {}) {
  const item = await repo.saveItem({ title: 'A', durationMinutes: 60 })
  const inst = await repo.saveInstance({
    itemId: item.id,
    date: '2099-01-05',
    time: '09:00',
    durationMinutes: 60,
    createdAt: hourAgo(),
    ...over,
  })
  return { item, inst }
}

describe('move tracking', () => {
  it('records how far a time move went, and a date move as a bigger one', async () => {
    const { inst } = await scheduled()
    await store().moveInstanceTime(inst.id, '10:30')
    await store().moveInstanceDate(inst.id, '2099-01-06')
    const { moves } = await repo.getInstance(inst.id)
    expect(moves.map((m) => m.minutes)).toEqual([90, 1440])
    expect(moves.every((m) => m.locked === false)).toBe(true)
  })

  it('costs one move for a combined date and time change', async () => {
    const { inst } = await scheduled()
    await store().moveInstanceDate(inst.id, '2099-01-06', { toTime: '11:00' })
    await store().moveInstanceTime(inst.id, '11:00', { record: false })
    const { moves } = await repo.getInstance(inst.id)
    expect(moves).toHaveLength(1)
    expect(moves[0].minutes).toBe(1440 + 120)
  })

  it('does not charge for a move right after scheduling', async () => {
    const { inst } = await scheduled({ createdAt: new Date().toISOString() })
    await store().moveInstanceTime(inst.id, '10:00')
    expect((await repo.getInstance(inst.id)).moves ?? []).toEqual([])
  })
})

describe('locking', () => {
  it('refuses to move a locked occurrence unless confirmed, then charges the locked rate', async () => {
    const { inst } = await scheduled()
    await store().setInstanceLocked(inst.id, true)
    await expect(store().moveInstanceTime(inst.id, '10:00')).rejects.toBeInstanceOf(LockedInstanceError)
    await expect(store().moveInstanceDate(inst.id, '2099-01-06')).rejects.toBeInstanceOf(LockedInstanceError)

    await store().moveInstanceTime(inst.id, '10:00', { confirmedLocked: true })
    const saved = await repo.getInstance(inst.id)
    expect(saved.time).toBe('10:00')
    expect(saved.moves).toEqual([expect.objectContaining({ minutes: 60, locked: true })])
  })

  it('keeps the lock and move history when a backlog item is rescheduled', async () => {
    const { item, inst } = await scheduled()
    await store().moveInstanceTime(inst.id, '10:00')
    await store().scheduleItemOnDate(item.id, '2099-01-07', { time: '10:00' })
    const [only] = await repo.getInstancesForItem(item.id)
    expect(only.date).toBe('2099-01-07')
    expect(only.moves.length).toBe(2)

    await store().setInstanceLocked(only.id, true)
    await expect(store().scheduleItemOnDate(item.id, '2099-01-08', { time: '10:00' })).rejects.toBeInstanceOf(
      LockedInstanceError,
    )
  })
})
