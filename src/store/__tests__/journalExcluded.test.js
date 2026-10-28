import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ items: [], allInstances: [], instancesByDate: {} })
})

const store = () => useEntityStore.getState()

describe('journalExcluded', () => {
  it('toggles an occurrence out of and back into the journal, persisted', async () => {
    const item = await repo.saveItem({ title: 'A' })
    const inst = await repo.saveInstance({ itemId: item.id, date: '2026-01-05', notes: '<p>hi</p>' })

    await store().setInstanceJournalExcluded(inst.id, true)
    expect((await repo.getInstance(inst.id)).journalExcluded).toBe(true)
    expect(store().allInstances.find((i) => i.id === inst.id).journalExcluded).toBe(true)

    await store().setInstanceJournalExcluded(inst.id, false)
    expect((await repo.getInstance(inst.id)).journalExcluded).toBe(false)
  })
})
