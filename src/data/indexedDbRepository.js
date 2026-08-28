import { getDb } from './db.js'
import { generateId } from './idGenerator.js'
import { isRichTextEmpty } from '../utils/richText.js'

const nowIso = () => new Date().toISOString()

// IndexedDB (per spec, and correctly enforced by fake-indexeddb) does not
// accept booleans as index keys. isUnscheduled/finalized are indexed, so
// they're stored as 0/1 and converted back to booleans at the read boundary.
const toItemRecord = (item) => ({ ...item, isUnscheduled: item.isUnscheduled ? 1 : 0 })
const fromItemRecord = (record) => (record ? { ...record, isUnscheduled: Boolean(record.isUnscheduled) } : record)
const toInstanceRecord = (inst) => ({ ...inst, finalized: inst.finalized ? 1 : 0 })
const fromInstanceRecord = (record) => (record ? { ...record, finalized: Boolean(record.finalized) } : record)

// ---------------------------------------------------------------------------
// Items
// ---------------------------------------------------------------------------

/** @returns {Promise<import('./types.js').Item|null>} */
export async function getItem(id) {
  const db = await getDb()
  const item = await db.get('items', id)
  return fromItemRecord(item) ?? null
}

/** @returns {Promise<import('./types.js').Item[]>} */
export async function getAllItems() {
  const db = await getDb()
  const all = await db.getAll('items')
  return all.filter((i) => !i.archived).map(fromItemRecord)
}

/**
 * @param {{categoryId?: string, isRecurring?: boolean, hasNotes?: boolean, searchText?: string}} [filter]
 * @returns {Promise<import('./types.js').Item[]>}
 */
export async function getBacklogItems(filter = {}) {
  const db = await getDb()
  const idx = db.transaction('items').store.index('isUnscheduled')
  let results = await idx.getAll(IDBKeyRange.only(1))
  results = results.filter((i) => !i.archived).map(fromItemRecord)

  if (filter.categoryId) {
    results = results.filter((i) => i.categoryId === filter.categoryId)
  }
  if (filter.isRecurring !== undefined) {
    results = results.filter((i) => Boolean(i.recurrence) === filter.isRecurring)
  }
  if (filter.hasNotes) {
    results = results.filter((i) => !isRichTextEmpty(i.notes))
  }
  if (filter.searchText) {
    const q = filter.searchText.toLowerCase()
    results = results.filter(
      (i) => i.title.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q)
    )
  }
  return results
}

/**
 * Upserts an item. Generates an id and timestamps if absent.
 * @param {Partial<import('./types.js').Item>} item
 * @returns {Promise<import('./types.js').Item>}
 */
export async function saveItem(item) {
  const db = await getDb()
  const existing = item.id ? fromItemRecord(await db.get('items', item.id)) : null
  const merged = {
    id: item.id ?? generateId(),
    title: '',
    durationMinutes: null,
    notes: '',
    categoryId: null,
    percentComplete: 0,
    parentIds: [],
    childIds: [],
    recurrence: null,
    isUnscheduled: true,
    isAllDay: false,
    isHabit: false,
    archived: false,
    order: Date.now(),
    syncEnabled: true,
    createdAt: nowIso(),
    ...existing,
    ...item,
    updatedAt: nowIso(),
  }
  if (!merged.title || !merged.title.trim()) {
    throw new Error('Item title is required')
  }
  await db.put('items', toItemRecord(merged))
  return merged
}

/**
 * Hard-deletes if the item has zero finalized instances, otherwise soft-deletes
 * (archived: true) and removes only its non-finalized instances.
 * @param {string} id
 */
export async function deleteItem(id) {
  const db = await getDb()
  const item = await db.get('items', id)
  if (!item) return

  const allInstances = await getInstancesForItem(id)
  const finalizedInstances = allInstances.filter((i) => i.finalized)
  const nonFinalizedInstances = allInstances.filter((i) => !i.finalized)

  const tx = db.transaction(['items', 'instances'], 'readwrite')
  for (const inst of nonFinalizedInstances) {
    await tx.objectStore('instances').delete(inst.id)
  }
  if (finalizedInstances.length > 0) {
    await tx.objectStore('items').put({ ...item, archived: true, updatedAt: nowIso() })
  } else {
    await tx.objectStore('items').delete(id)
  }
  await tx.done

  // clean up parent/child references
  const others = await getAllItems()
  for (const other of others) {
    const hasParent = other.parentIds.includes(id)
    const hasChild = other.childIds.includes(id)
    if (hasParent || hasChild) {
      await saveItem({
        ...other,
        parentIds: hasParent ? other.parentIds.filter((x) => x !== id) : other.parentIds,
        childIds: hasChild ? other.childIds.filter((x) => x !== id) : other.childIds,
      })
    }
  }
}

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

/** @returns {Promise<import('./types.js').Category[]>} */
export async function getAllCategories() {
  const db = await getDb()
  const all = await db.getAll('categories')
  // IndexedDB's natural order is by keyPath (a random-looking uuid), not
  // insertion order, so sort explicitly to keep newly-added categories last.
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt))
}

/**
 * @param {Partial<import('./types.js').Category>} category
 * @returns {Promise<import('./types.js').Category>}
 */
export async function saveCategory(category) {
  const db = await getDb()
  const existing = category.id ? await db.get('categories', category.id) : null
  const merged = {
    id: category.id ?? generateId(),
    name: '',
    color: '#3b6fe0',
    createdAt: nowIso(),
    ...existing,
    ...category,
    updatedAt: nowIso(),
  }
  if (!merged.name || !merged.name.trim()) {
    throw new Error('Category name is required')
  }
  await db.put('categories', merged)
  return merged
}

/**
 * Deletes a category, reassigning affected items' categoryId to null.
 * @param {string} id
 */
export async function deleteCategory(id) {
  const db = await getDb()
  const items = await getAllItems()
  for (const item of items) {
    if (item.categoryId === id) {
      await saveItem({ ...item, categoryId: null })
    }
  }
  await db.delete('categories', id)
}

// ---------------------------------------------------------------------------
// Scheduled Instances
// ---------------------------------------------------------------------------

/** @returns {Promise<import('./types.js').ScheduledInstance|null>} */
export async function getInstance(id) {
  const db = await getDb()
  const inst = await db.get('instances', id)
  return fromInstanceRecord(inst) ?? null
}

/** @returns {Promise<import('./types.js').ScheduledInstance[]>} */
export async function getAllInstances() {
  const db = await getDb()
  const all = await db.getAll('instances')
  return all.map(fromInstanceRecord)
}

/** @returns {Promise<import('./types.js').ScheduledInstance[]>} */
export async function getInstancesForDate(date) {
  const db = await getDb()
  const results = await db.getAllFromIndex('instances', 'date', date)
  return results.map(fromInstanceRecord)
}

/** @returns {Promise<import('./types.js').ScheduledInstance[]>} */
export async function getInstancesForDateRange(startDate, endDate) {
  const db = await getDb()
  const range = IDBKeyRange.bound(startDate, endDate)
  const results = await db.getAllFromIndex('instances', 'date', range)
  return results.map(fromInstanceRecord)
}

/** @returns {Promise<import('./types.js').ScheduledInstance[]>} */
export async function getInstancesForItem(itemId) {
  const db = await getDb()
  const results = await db.getAllFromIndex('instances', 'itemId', itemId)
  return results.map(fromInstanceRecord)
}

/**
 * Returns all non-finalized instances with date <= the given date, ascending by date.
 * Used by the rollover pass.
 * @param {string} throughDate
 * @returns {Promise<import('./types.js').ScheduledInstance[]>}
 */
export async function getPendingInstancesThrough(throughDate) {
  const db = await getDb()
  const range = IDBKeyRange.bound([0, ''], [0, throughDate])
  const results = await db.getAllFromIndex('instances', 'finalized_date', range)
  return results.map(fromInstanceRecord).sort((a, b) => a.date.localeCompare(b.date))
}

/**
 * @param {Partial<import('./types.js').ScheduledInstance>} instance
 * @returns {Promise<import('./types.js').ScheduledInstance>}
 */
export async function saveInstance(instance) {
  const db = await getDb()
  const existing = instance.id ? fromInstanceRecord(await db.get('instances', instance.id)) : null
  const merged = {
    id: instance.id ?? generateId(),
    itemId: instance.itemId,
    date: instance.date,
    time: null,
    durationMinutes: null,
    isAllDay: false,
    notes: '',
    percentComplete: 0,
    startPercent: null,
    status: 'pending',
    finalized: false,
    finalPercent: null,
    createdAt: nowIso(),
    ...existing,
    ...instance,
    updatedAt: nowIso(),
  }
  await db.put('instances', toInstanceRecord(merged))
  return merged
}

export async function deleteInstance(id) {
  const db = await getDb()
  await db.delete('instances', id)
}

/** @param {import('./types.js').ScheduledInstance[]} instances */
export async function bulkSaveInstances(instances) {
  const db = await getDb()
  const tx = db.transaction('instances', 'readwrite')
  for (const instance of instances) {
    await tx.store.put(toInstanceRecord(instance))
  }
  await tx.done
}

// ---------------------------------------------------------------------------
// Journal
// ---------------------------------------------------------------------------

/** @returns {Promise<import('./types.js').DayJournal|null>} */
export async function getJournalForDate(date) {
  const db = await getDb()
  const journal = await db.get('journals', date)
  return journal ?? null
}

/** @returns {Promise<import('./types.js').DayJournal[]>} */
export async function getAllJournals() {
  const db = await getDb()
  return db.getAll('journals')
}

/**
 * @param {Partial<import('./types.js').DayJournal>} journal
 * @returns {Promise<import('./types.js').DayJournal>}
 */
export async function saveJournal(journal) {
  const db = await getDb()
  const existing = journal.date ? await db.get('journals', journal.date) : null
  const merged = {
    content: '',
    mood: null,
    spouseMood: null,
    screenTimeMinutes: null,
    ...existing,
    ...journal,
    updatedAt: nowIso(),
  }
  await db.put('journals', merged)
  return merged
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/** @returns {Promise<import('./types.js').Item[]>} */
export async function searchItems(query) {
  const q = query.trim().toLowerCase()
  if (!q) return []
  const all = await getAllItems()
  return all.filter(
    (i) => i.title.toLowerCase().includes(q) || i.notes.toLowerCase().includes(q)
  )
}
