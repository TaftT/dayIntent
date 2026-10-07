import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ items: [], allInstances: [], categories: [], groups: [] })
})

const store = () => useEntityStore.getState()

describe('backlog groups', () => {
  it('creates groups with a name and color, and puts items in them', async () => {
    const a = await repo.saveItem({ title: 'A' })
    await store().refreshItems()

    const g = await store().createGroup('  Moving  ')
    expect(g.name).toBe('Moving')
    expect(g.color).toBeTruthy()
    expect(store().groups.map((x) => x.name)).toEqual(['Moving'])

    await store().setItemsGroup([a.id], g.id)
    expect(store().items[0].groupId).toBe(g.id)
    expect((await repo.getItem(a.id)).groupId).toBe(g.id) // persisted

    await store().setItemsGroup([a.id], null)
    expect(store().items[0].groupId).toBeNull()
  })

  it('renames and recolors in one place (items follow by id)', async () => {
    const g = await store().createGroup('Old')
    const a = await repo.saveItem({ title: 'A', groupId: g.id })
    await store().refreshItems()

    await store().saveGroup({ id: g.id, name: 'New', color: '#123456' })
    expect(store().groups[0]).toMatchObject({ name: 'New', color: '#123456' })
    expect(store().items.find((i) => i.id === a.id).groupId).toBe(g.id)
  })

  it('reorders groups and the order sticks', async () => {
    const a = await store().createGroup('A')
    const b = await store().createGroup('B')
    const c = await store().createGroup('C')
    expect(store().groups.map((g) => g.name)).toEqual(['A', 'B', 'C'])

    await store().reorderGroups([c.id, a.id, b.id])
    expect(store().groups.map((g) => g.name)).toEqual(['C', 'A', 'B'])

    await store().refreshGroups() // reload from IndexedDB
    expect(store().groups.map((g) => g.name)).toEqual(['C', 'A', 'B'])
  })

  it('reorders categories and the order sticks', async () => {
    const a = await store().saveCategory({ name: 'A' })
    const b = await store().saveCategory({ name: 'B' })
    expect(store().categories.map((c) => c.name)).toEqual(['A', 'B'])

    await store().reorderCategories([b.id, a.id])
    await store().refreshCategories()
    expect(store().categories.map((c) => c.name)).toEqual(['B', 'A'])
  })

  it('deleting a group keeps its tasks and ungroups them', async () => {
    const g = await store().createGroup('Temp')
    const a = await repo.saveItem({ title: 'A', groupId: g.id })
    await store().refreshItems()

    await store().deleteGroup(g.id)
    expect(store().groups).toEqual([])
    expect(store().items.find((i) => i.id === a.id).groupId).toBeNull()
  })

  it('migrates legacy name-based groups into group records (once)', async () => {
    await repo.saveItem({ title: 'A', group: 'Errands' })
    await repo.saveItem({ title: 'B', group: 'errands' })
    await repo.saveItem({ title: 'C' })

    await store().migrateGroupNames()
    await store().refreshGroups()
    await store().refreshItems()

    // names that differ only by case collapse into one group
    expect(store().groups.map((g) => g.name.toLowerCase())).toEqual(['errands'])
    const gid = store().groups[0].id
    const byTitle = Object.fromEntries(store().items.map((i) => [i.title, i.groupId]))
    expect(byTitle).toMatchObject({ A: gid, B: gid, C: null })

    await store().migrateGroupNames() // idempotent
    await store().refreshGroups()
    expect(store().groups).toHaveLength(1)
  })
})
