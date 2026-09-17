import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'
import { useAuthStore } from '../useAuthStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({
    categories: [],
    items: [],
    instancesByDate: {},
    allInstances: [],
    journalsByDate: {},
    allJournals: [],
    initialized: false,
  })
})

// _purgeSyncedOnSignOut is what both "Sign out" (TopBar) and "Sign out
// instead" (UnlockPrompt) ultimately run — they call the same store action.
describe('_purgeSyncedOnSignOut', () => {
  it('removes synced items/instances from the store and IndexedDB, keeps local-only ones', async () => {
    const synced = await repo.saveItem({ title: 'Synced task', syncEnabled: true })
    const local = await repo.saveItem({ title: 'Local task', syncEnabled: false })
    await repo.saveInstance({ itemId: synced.id, date: '2026-09-08' })
    await repo.saveInstance({ itemId: local.id, date: '2026-09-08' })

    await useEntityStore.getState().refreshItems()
    await useEntityStore.getState().loadInstancesForDate('2026-09-08')
    expect(useEntityStore.getState().items).toHaveLength(2)
    expect(useEntityStore.getState().instancesByDate['2026-09-08']).toHaveLength(2)

    await useAuthStore.getState()._purgeSyncedOnSignOut()

    expect(useEntityStore.getState().items.map((i) => i.title)).toEqual(['Local task'])
    expect(useEntityStore.getState().instancesByDate['2026-09-08']).toHaveLength(1)
    expect(useEntityStore.getState().allInstances).toHaveLength(1)
    expect(await repo.getItem(synced.id)).toBeNull()
    expect(await repo.getItem(local.id)).not.toBeNull()
  })
})
