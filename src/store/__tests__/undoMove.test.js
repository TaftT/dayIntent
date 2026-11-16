import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'

const snap = (i) => ({ id: i.id, time: i.time, isAllDay: i.isAllDay, moves: i.moves, percentComplete: i.percentComplete })

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ moveHistory: [] })
})

describe('undo day-view move', () => {
  it('puts a moved item back to its time and move count', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const inst = await repo.saveInstance({ itemId: item.id, date: '2099-01-05', time: '09:00', durationMinutes: 60 })

    useEntityStore.getState().recordMove([snap(inst)])
    await useEntityStore.getState().moveInstanceTime(inst.id, '14:00')
    expect((await repo.getInstance(inst.id)).time).toBe('14:00')

    expect(await useEntityStore.getState().undoLastMove()).toBe(true)
    const back = await repo.getInstance(inst.id)
    expect(back.time).toBe('09:00')
    expect(back.moves).toEqual(inst.moves)
    expect(await useEntityStore.getState().undoLastMove()).toBe(false)
  })

  it('undoes a multi-item drag as one step', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const a = await repo.saveInstance({ itemId: item.id, date: '2099-01-05', time: '09:00', durationMinutes: 30 })
    const b = await repo.saveInstance({ itemId: item.id, date: '2099-01-05', time: '11:00', durationMinutes: 30 })
    useEntityStore.getState().recordMove([snap(a), snap(b)])
    await useEntityStore.getState().moveInstanceTime(a.id, '10:00')
    await useEntityStore.getState().moveInstanceTime(b.id, '12:00')

    await useEntityStore.getState().undoLastMove()
    expect((await repo.getInstance(a.id)).time).toBe('09:00')
    expect((await repo.getInstance(b.id)).time).toBe('11:00')
  })
})
