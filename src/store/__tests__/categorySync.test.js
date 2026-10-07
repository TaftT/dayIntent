import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import { useEntityStore } from '../useEntityStore.js'
import { useAuthStore } from '../useAuthStore.js'
import { isCategorySynced } from '../../utils/categorySync.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ categories: [], items: [], groups: [] })
  useAuthStore.setState({ user: null })
})

describe('synced vs device-local categories', () => {
  it('new categories are device-local while signed out and synced while signed in', async () => {
    const offline = await useEntityStore.getState().saveCategory({ name: 'Offline' })
    expect(offline.syncEnabled).toBe(false)
    expect(isCategorySynced(offline)).toBe(false)

    useAuthStore.setState({ user: { uid: 'u1', email: 'a@b.c' } })
    const online = await useEntityStore.getState().saveCategory({ name: 'Online' })
    expect(online.syncEnabled).toBe(true)
  })

  it('an explicit choice wins, and editing never flips the flag', async () => {
    useAuthStore.setState({ user: { uid: 'u1', email: 'a@b.c' } })
    const local = await useEntityStore.getState().saveCategory({ name: 'Mine', syncEnabled: false })
    expect(local.syncEnabled).toBe(false)

    const renamed = await useEntityStore.getState().saveCategory({ id: local.id, name: 'Mine 2' })
    expect(renamed.syncEnabled).toBe(false)
  })

  it('categories from before the split (no flag) count as synced', () => {
    expect(isCategorySynced({ name: 'Old' })).toBe(true)
    expect(isCategorySynced({ name: 'New', syncEnabled: false })).toBe(false)
  })
})
