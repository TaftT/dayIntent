import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ items: [], allInstances: [], categories: [] })
})

describe('backlog groups', () => {
  it('setItemsGroup stores the group on the items and the store sees it', async () => {
    const a = await repo.saveItem({ title: 'A' })
    const b = await repo.saveItem({ title: 'B' })
    await useEntityStore.getState().refreshItems()

    await useEntityStore.getState().setItemsGroup([a.id, b.id], '  Moving  ')

    const items = useEntityStore.getState().items
    expect(items.map((i) => i.group)).toEqual(['Moving', 'Moving'])
    // persisted, not just in memory
    expect((await repo.getItem(a.id)).group).toBe('Moving')
  })

  it('removes the group with null, and renames across all members', async () => {
    const a = await repo.saveItem({ title: 'A', group: 'Old' })
    const b = await repo.saveItem({ title: 'B', group: 'Old' })
    await useEntityStore.getState().refreshItems()

    await useEntityStore.getState().renameGroup('Old', 'New')
    expect(useEntityStore.getState().items.map((i) => i.group)).toEqual(['New', 'New'])

    await useEntityStore.getState().setItemsGroup([a.id], null)
    const byId = Object.fromEntries(useEntityStore.getState().items.map((i) => [i.id, i.group]))
    expect(byId[a.id]).toBeNull()
    expect(byId[b.id]).toBe('New')
  })
})
