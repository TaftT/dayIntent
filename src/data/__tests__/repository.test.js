import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../db.js'
import * as repo from '../index.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
})

describe('items', () => {
  it('requires a title', async () => {
    await expect(repo.saveItem({})).rejects.toThrow(/title/i)
  })

  it('saves and retrieves an item with defaults applied', async () => {
    const saved = await repo.saveItem({ title: 'Write tests' })
    expect(saved.id).toBeTruthy()
    expect(saved.percentComplete).toBe(0)
    expect(saved.isUnscheduled).toBe(true)

    const fetched = await repo.getItem(saved.id)
    expect(fetched.title).toBe('Write tests')
  })

  it('updates only provided fields on upsert', async () => {
    const saved = await repo.saveItem({ title: 'Task', notes: 'original' })
    const updated = await repo.saveItem({ id: saved.id, percentComplete: 50 })
    expect(updated.title).toBe('Task')
    expect(updated.notes).toBe('original')
    expect(updated.percentComplete).toBe(50)
  })
})

describe('backlog filtering', () => {
  it('returns only unscheduled items, optionally filtered by category', async () => {
    const cat = await repo.saveCategory({ name: 'Work', color: '#fff' })
    await repo.saveItem({ title: 'Backlog A', isUnscheduled: true, categoryId: cat.id })
    await repo.saveItem({ title: 'Backlog B', isUnscheduled: true })
    await repo.saveItem({ title: 'Scheduled', isUnscheduled: false })

    const all = await repo.getBacklogItems()
    expect(all.map((i) => i.title).sort()).toEqual(['Backlog A', 'Backlog B'])

    const filtered = await repo.getBacklogItems({ categoryId: cat.id })
    expect(filtered.map((i) => i.title)).toEqual(['Backlog A'])
  })

  it('search matches title and notes, case-insensitively', async () => {
    await repo.saveItem({ title: 'Buy groceries', notes: '' })
    await repo.saveItem({ title: 'Something else', notes: 'remember the GROCERY list' })
    await repo.saveItem({ title: 'Unrelated', notes: '' })

    const results = await repo.searchItems('grocer')
    expect(results.map((i) => i.title).sort()).toEqual(['Buy groceries', 'Something else'])
  })
})

describe('categories', () => {
  it('reassigns items to null category on delete', async () => {
    const cat = await repo.saveCategory({ name: 'Temp', color: '#000' })
    const item = await repo.saveItem({ title: 'Task', categoryId: cat.id })

    await repo.deleteCategory(cat.id)

    const fetched = await repo.getItem(item.id)
    expect(fetched.categoryId).toBeNull()
  })
})

describe('deleteItem', () => {
  it('hard-deletes an item with no finalized instances', async () => {
    const item = await repo.saveItem({ title: 'Throwaway' })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-20' })

    await repo.deleteItem(item.id)

    expect(await repo.getItem(item.id)).toBeNull()
    expect(await repo.getInstancesForItem(item.id)).toHaveLength(0)
  })

  it('soft-deletes an item with finalized instances, keeping history resolvable', async () => {
    const item = await repo.saveItem({ title: 'Historic' })
    const finalizedInst = await repo.saveInstance({
      itemId: item.id,
      date: '2026-08-01',
      finalized: true,
      status: 'completed',
    })
    const pendingInst = await repo.saveInstance({ itemId: item.id, date: '2026-08-20' })

    await repo.deleteItem(item.id)

    const archived = await repo.getItem(item.id)
    expect(archived.archived).toBe(true)
    expect(await repo.getInstance(finalizedInst.id)).not.toBeNull()
    expect(await repo.getInstance(pendingInst.id)).toBeNull()

    const backlog = await repo.getBacklogItems()
    expect(backlog.find((i) => i.id === item.id)).toBeUndefined()
  })

  it('removes parent/child references when the linked item is deleted', async () => {
    const child = await repo.saveItem({ title: 'Child' })
    const parent = await repo.saveItem({ title: 'Parent', childIds: [child.id] })
    await repo.saveItem({ id: child.id, parentIds: [parent.id] })

    await repo.deleteItem(child.id)

    const fetchedParent = await repo.getItem(parent.id)
    expect(fetchedParent.childIds).toEqual([])
  })
})

describe('clearItemsAndInstances', () => {
  it('wipes every item and instance regardless of sync flag, leaving categories/journals', async () => {
    const cat = await repo.saveCategory({ name: 'Work', color: '#fff' })
    const synced = await repo.saveItem({ title: 'Synced', syncEnabled: true })
    const local = await repo.saveItem({ title: 'Local only', syncEnabled: false })
    await repo.saveInstance({ itemId: synced.id, date: '2026-08-01', finalized: true, status: 'completed' })
    await repo.saveInstance({ itemId: local.id, date: '2026-09-20' })
    await repo.saveJournal({ date: '2026-09-20', content: 'kept' })

    await repo.clearItemsAndInstances()

    expect(await repo.getAllItems()).toHaveLength(0)
    expect(await repo.getAllInstances()).toHaveLength(0)
    expect(await repo.getItem(synced.id)).toBeNull()
    expect(await repo.getItem(local.id)).toBeNull()
    expect((await repo.getAllCategories()).map((c) => c.id)).toEqual([cat.id])
    expect((await repo.getJournalForDate('2026-09-20'))?.content).toBe('kept')
  })
})

describe('instances', () => {
  it('getInstancesForDate returns only that date', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-19' })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-20' })

    const day = await repo.getInstancesForDate('2026-08-19')
    expect(day).toHaveLength(1)
    expect(day[0].date).toBe('2026-08-19')
  })

  it('getPendingInstancesThrough excludes finalized and future instances, sorted ascending', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-18' })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-17' })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-19', finalized: true })
    await repo.saveInstance({ itemId: item.id, date: '2026-08-25' })

    const pending = await repo.getPendingInstancesThrough('2026-08-19')
    expect(pending.map((i) => i.date)).toEqual(['2026-08-17', '2026-08-18'])
  })
})
