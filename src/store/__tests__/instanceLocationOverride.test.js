import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'
import { applyInstanceOverrides } from '../../hooks/useItem.js'

const vegas = { lat: 36.17, lon: -115.14, label: 'Las Vegas' }
const denver = { lat: 39.74, lon: -104.99, label: 'Denver' }

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
})

describe('per-occurrence location', () => {
  it('stores a changed place on the occurrence only, leaving the series and other days alone', async () => {
    const item = await repo.saveItem({ title: 'Sleep', location: vegas })
    const a = await repo.saveInstance({ itemId: item.id, date: '2099-01-05' })
    const b = await repo.saveInstance({ itemId: item.id, date: '2099-01-06' })

    await useEntityStore.getState().setInstanceOverrides(a.id, { title: 'Sleep', categoryId: null, location: denver })

    const [ia, ib] = [await repo.getInstance(a.id), await repo.getInstance(b.id)]
    expect(applyInstanceOverrides(item, ia).location).toEqual(denver)
    expect(applyInstanceOverrides(item, ib).location).toEqual(vegas)
    expect((await repo.getItem(item.id)).location).toEqual(vegas)
  })

  it('removing the place on one day is an explicit "none", and matching the series inherits again', async () => {
    const item = await repo.saveItem({ title: 'Sleep', location: vegas })
    const a = await repo.saveInstance({ itemId: item.id, date: '2099-01-05' })

    await useEntityStore.getState().setInstanceOverrides(a.id, { title: 'Sleep', categoryId: null, location: null })
    expect(applyInstanceOverrides(item, await repo.getInstance(a.id)).location).toBeNull()

    await useEntityStore.getState().setInstanceOverrides(a.id, { title: 'Sleep', categoryId: null, location: vegas })
    expect((await repo.getInstance(a.id)).locationOverride).toBeUndefined()
  })
})
