// Wraps indexedDbRepository with cloud-sync side effects. All read functions
// pass straight through unchanged; the mutating functions save locally first
// (unchanged local-first behavior, works with no one signed in) and then fire
// an async, non-blocking push/remove to Firebase — local writes never wait on
// the network. See src/sync/syncEngine.js for the actual push/pull logic.
export * from './indexedDbRepository.js'

import * as raw from './indexedDbRepository.js'
import * as syncEngine from '../sync/syncEngine.js'

export async function saveItem(itemPartial) {
  const saved = await raw.saveItem(itemPartial)
  syncEngine.pushItem(saved).catch(() => {})
  return saved
}

export async function deleteItem(id) {
  await raw.deleteItem(id)
  syncEngine.deleteItemRemote(id).catch(() => {})
}

export async function saveInstance(instancePartial) {
  const saved = await raw.saveInstance(instancePartial)
  const parent = await raw.getItem(saved.itemId)
  syncEngine.pushInstance(saved, parent?.syncEnabled ?? false).catch(() => {})
  return saved
}

export async function deleteInstance(id) {
  await raw.deleteInstance(id)
  syncEngine.deleteInstanceRemote(id).catch(() => {})
}

export async function saveCategory(categoryPartial) {
  const saved = await raw.saveCategory(categoryPartial)
  // Device-local categories never go to the cloud.
  if (saved.syncEnabled !== false) syncEngine.pushCategory(saved).catch(() => {})
  return saved
}

export async function deleteCategory(id) {
  await raw.deleteCategory(id)
  syncEngine.removeCategory(id).catch(() => {})
}

export async function saveGroup(groupPartial) {
  const saved = await raw.saveGroup(groupPartial)
  syncEngine.pushGroup(saved).catch(() => {})
  return saved
}

export async function deleteGroup(id) {
  // Deleting a group takes its tasks out of it; those item edits need to
  // reach the cloud too (the raw repository write doesn't push).
  const members = (await raw.getAllItems()).filter((i) => i.groupId === id).map((i) => i.id)
  await raw.deleteGroup(id)
  syncEngine.removeGroup(id).catch(() => {})
  for (const itemId of members) {
    const item = await raw.getItem(itemId)
    if (item) syncEngine.pushItem(item).catch(() => {})
  }
}

export async function saveJournal(journalPartial) {
  const saved = await raw.saveJournal(journalPartial)
  syncEngine.pushJournal(saved).catch(() => {})
  return saved
}

export async function bulkSaveInstances(instances) {
  await raw.bulkSaveInstances(instances)
  const byItemId = new Map()
  for (const instance of instances) {
    if (!byItemId.has(instance.itemId)) byItemId.set(instance.itemId, [])
    byItemId.get(instance.itemId).push(instance)
  }
  for (const [itemId, group] of byItemId) {
    const parent = await raw.getItem(itemId)
    syncEngine.pushInstancesBulk(group, parent?.syncEnabled ?? false).catch(() => {})
  }
}
