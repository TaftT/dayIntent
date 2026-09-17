// Two-way real-time sync between IndexedDB (source of truth for the UI) and
// Firebase Realtime Database (encrypted, per-user store). Items and their
// instances sync only when the item's syncEnabled is on; categories and
// journal entries have no per-record toggle — they sync unconditionally
// whenever someone is signed in, since they're global/day-keyed rather than
// individually ownable the way an item is.
//
// Push (local -> cloud) always wins on the writer's side: a local save always
// overwrites the corresponding cloud node, stamped with the save's own
// updatedAt. Pull (cloud -> local) is last-write-wins by comparing plaintext
// updatedAt fields, and writes straight through the raw indexedDbRepository
// (not syncedRepository) so an incoming remote change never re-triggers a
// push back to the cloud.
//
// Items/instances specifically need to tell "delete this item" apart from
// "turn sync off for this item" — both remove the cloud node, but only the
// former should ever cause another device to delete its own local copy
// (propagating a sync-toggle-off as a delete would wipe local data just from
// flipping a switch elsewhere). So a real delete additionally writes a
// tombstone (deletedItems/deletedInstances, keyed by id) alongside removing
// the live node; a toggle-off does not. Any device — via a live listener, or
// on its next full reconcile — treats a tombstoned id it still has locally
// as "delete this locally too" instead of pushing its still-existing local
// copy back up and resurrecting it. Categories have no such ambiguity (no
// toggle, so a removed cloud category can only mean it was actually
// deleted), so category deletions already propagated directly, no tombstone
// needed there.

import { ref, set, remove, update, get, onChildAdded, onChildChanged, onChildRemoved } from 'firebase/database'
import { rtdb, firebaseEnabled } from '../firebase/config.js'
import { generateSalt, generateDataKey, wrapKey, unwrapKey, encryptJson, decryptJson } from '../firebase/crypto.js'
import * as localRepo from '../data/indexedDbRepository.js'
import { useEntityStore } from '../store/useEntityStore.js'

// { uid, masterKey, pullOnly } while signed in and sync is active. pullOnly is
// set when this device's local data was last synced under a different account
// (see OwnerMismatchError): the cloud is still pulled down and merged onto the
// screen live, but nothing local is ever pushed up until the user explicitly
// adopts this device via forceSyncThisDevice.
let state = null
let detachFns = []

function canPush() {
  return state !== null && !state.pullOnly && firebaseEnabled
}

const itemsPath = (uid) => `users/${uid}/items`
const instancesPath = (uid) => `users/${uid}/instances`
const categoriesPath = (uid) => `users/${uid}/categories`
const journalsPath = (uid) => `users/${uid}/journals`
const saltPath = (uid) => `users/${uid}/meta/salt`
const deletedItemsPath = (uid) => `users/${uid}/deletedItems`
const deletedInstancesPath = (uid) => `users/${uid}/deletedInstances`

export async function getOrCreateSalt(uid) {
  const snap = await get(ref(rtdb, saltPath(uid)))
  if (snap.exists()) return snap.val()
  const salt = generateSalt()
  await set(ref(rtdb, saltPath(uid)), salt)
  return salt
}

async function buildEnvelope(payload, masterKey) {
  const dataKey = await generateDataKey()
  const { wrappedKey, keyIv } = await wrapKey(dataKey, masterKey)
  const { ciphertext, iv } = await encryptJson(payload, dataKey)
  return { wrappedKey, keyIv, ciphertext, iv }
}

async function openEnvelope(record, masterKey) {
  const dataKey = await unwrapKey(record.wrappedKey, record.keyIv, masterKey)
  return decryptJson({ ciphertext: record.ciphertext, iv: record.iv }, dataKey)
}

// Decrypts one record for the reconcile pass without letting a single bad
// record (corrupt, or from some future incompatible format) abort the whole
// sync. `stats` tallies attempts/successes across the whole reconcileAll
// call so it can tell "one weird record" apart from "every record failed,
// this password is just wrong" once everything's been processed.
async function tryOpenEnvelope(record, masterKey, stats) {
  stats.attempts++
  try {
    const result = await openEnvelope(record, masterKey)
    stats.successes++
    return { ok: true, value: result }
  } catch (err) {
    console.warn('[sync] could not decrypt a record — skipping it', err)
    return { ok: false }
  }
}

// ---- Push (local -> cloud) -------------------------------------------------

// Firebase's set() rejects any `undefined` value outright — and records
// created before updatedAt existed on instances (or any future field added
// the same way) predate that field and don't have it. Falling back to
// createdAt (always present) rather than "now" keeps last-write-wins
// comparisons meaningful instead of making a genuinely old record look
// freshly edited.
function resolveUpdatedAt(record) {
  return record.updatedAt ?? record.createdAt ?? new Date().toISOString()
}

export async function pushItem(item) {
  if (!canPush()) return
  if (!item.syncEnabled) return removeItem(item.id)
  const envelope = await buildEnvelope(item, state.masterKey)
  await set(ref(rtdb, `${itemsPath(state.uid)}/${item.id}`), { updatedAt: resolveUpdatedAt(item), ...envelope })
}

export async function removeItem(itemId) {
  if (!canPush()) return
  await remove(ref(rtdb, `${itemsPath(state.uid)}/${itemId}`))
  const snap = await get(ref(rtdb, instancesPath(state.uid)))
  if (snap.exists()) {
    const updates = {}
    snap.forEach((child) => {
      if (child.val().itemId === itemId) updates[child.key] = null
    })
    if (Object.keys(updates).length > 0) await update(ref(rtdb, instancesPath(state.uid)), updates)
  }
}

export async function pushInstance(instance, parentSyncEnabled) {
  if (!canPush()) return
  if (!parentSyncEnabled) return removeInstance(instance.id)
  const envelope = await buildEnvelope(instance, state.masterKey)
  await set(ref(rtdb, `${instancesPath(state.uid)}/${instance.id}`), {
    itemId: instance.itemId,
    updatedAt: resolveUpdatedAt(instance),
    ...envelope,
  })
}

export async function removeInstance(instanceId) {
  if (!canPush()) return
  await remove(ref(rtdb, `${instancesPath(state.uid)}/${instanceId}`))
}

// A real delete (as opposed to toggling sync off) — removes the item and its
// instances from the live tree exactly like removeItem, but also leaves a
// tombstone for the item and each of its instances so another device that
// still has them locally deletes its own copy on next sync instead of
// pushing it back up. See the file-level comment for why this needs to be a
// separate path from removeItem/removeInstance.
export async function deleteItemRemote(itemId) {
  if (!canPush()) return
  const deletedAt = new Date().toISOString()
  const updates = {
    [`${itemsPath(state.uid)}/${itemId}`]: null,
    [`${deletedItemsPath(state.uid)}/${itemId}`]: deletedAt,
  }
  const snap = await get(ref(rtdb, instancesPath(state.uid)))
  if (snap.exists()) {
    snap.forEach((child) => {
      if (child.val().itemId === itemId) {
        updates[`${instancesPath(state.uid)}/${child.key}`] = null
        updates[`${deletedInstancesPath(state.uid)}/${child.key}`] = deletedAt
      }
    })
  }
  await update(ref(rtdb), updates)
}

export async function deleteInstanceRemote(instanceId) {
  if (!canPush()) return
  await update(ref(rtdb), {
    [`${instancesPath(state.uid)}/${instanceId}`]: null,
    [`${deletedInstancesPath(state.uid)}/${instanceId}`]: new Date().toISOString(),
  })
}

export async function pushInstancesBulk(instances, parentSyncEnabled) {
  for (const instance of instances) {
    await pushInstance(instance, parentSyncEnabled)
  }
}

export async function pushCategory(category) {
  if (!canPush()) return
  const envelope = await buildEnvelope(category, state.masterKey)
  await set(ref(rtdb, `${categoriesPath(state.uid)}/${category.id}`), { updatedAt: resolveUpdatedAt(category), ...envelope })
}

export async function removeCategory(categoryId) {
  if (!canPush()) return
  await remove(ref(rtdb, `${categoriesPath(state.uid)}/${categoryId}`))
}

// Journals are keyed by date rather than a generated id, and there's no
// "delete a journal entry" concept in the app, so there's no removeJournal.
export async function pushJournal(journal) {
  if (!canPush()) return
  const envelope = await buildEnvelope(journal, state.masterKey)
  await set(ref(rtdb, `${journalsPath(state.uid)}/${journal.date}`), { updatedAt: resolveUpdatedAt(journal), ...envelope })
}

// ---- Pull (cloud -> local) --------------------------------------------------

// Live listeners fire-and-forget (nothing awaits them), so a decrypt
// failure here can't be surfaced as a rejected promise the way reconcileAll
// can — just log and skip that one update rather than let it become an
// unhandled rejection.
async function safeOpenEnvelope(record, masterKey) {
  try {
    return { ok: true, value: await openEnvelope(record, masterKey) }
  } catch (err) {
    console.warn('[sync] could not decrypt an incoming update — skipping it', err)
    return { ok: false }
  }
}

async function mergeRemoteItem(id, record) {
  if (!state || !record) return
  const local = await localRepo.getItem(id)
  if (local && local.updatedAt >= record.updatedAt) return
  const opened = await safeOpenEnvelope(record, state.masterKey)
  if (!opened.ok) return
  await localRepo.saveItem(opened.value, { preserveTimestamp: true })
  useEntityStore.getState().refreshItems()
}

async function mergeRemoteInstance(id, record) {
  if (!state || !record) return
  const local = await localRepo.getInstance(id)
  if (local && local.updatedAt >= record.updatedAt) return
  const opened = await safeOpenEnvelope(record, state.masterKey)
  if (!opened.ok) return
  await localRepo.saveInstance(opened.value, { preserveTimestamp: true })
  await useEntityStore.getState().refreshAllInstances()
  await useEntityStore.getState().reloadLoadedDates()
}

async function mergeRemoteCategory(id, record) {
  if (!state || !record) return
  const local = (await localRepo.getAllCategories()).find((c) => c.id === id)
  if (local && local.updatedAt >= record.updatedAt) return
  const opened = await safeOpenEnvelope(record, state.masterKey)
  if (!opened.ok) return
  await localRepo.saveCategory(opened.value, { preserveTimestamp: true })
  useEntityStore.getState().refreshCategories()
}

// Unlike items, a category removal is unambiguous (no sync toggle to
// confuse it with), so this is safe to propagate as a real local delete.
async function removeRemoteCategory(id) {
  if (!state) return
  await localRepo.deleteCategory(id)
  useEntityStore.getState().refreshCategories()
  useEntityStore.getState().refreshItems()
}

// A tombstone appearing (from this device's own deleteItemRemote/
// deleteInstanceRemote, or another device's) means the id is really gone —
// delete the local copy immediately rather than waiting for the next full
// reconcile to catch it via the deletedItemIds/deletedInstanceIds check.
async function handleRemoteItemDeleted(itemId) {
  if (!state) return
  await localRepo.deleteItem(itemId)
  useEntityStore.getState().refreshItems()
  await useEntityStore.getState().refreshAllInstances()
  await useEntityStore.getState().reloadLoadedDates()
}

async function handleRemoteInstanceDeleted(instanceId) {
  if (!state) return
  await localRepo.deleteInstance(instanceId)
  await useEntityStore.getState().refreshAllInstances()
  await useEntityStore.getState().reloadLoadedDates()
}

async function mergeRemoteJournal(date, record) {
  if (!state || !record) return
  const local = await localRepo.getJournalForDate(date)
  if (local && local.updatedAt >= record.updatedAt) return
  const opened = await safeOpenEnvelope(record, state.masterKey)
  if (!opened.ok) return
  await localRepo.saveJournal(opened.value, { preserveTimestamp: true })
  // Only refresh a date that's actually cached — an unviewed date will pick
  // up the merged local data naturally next time it's loaded.
  if (date in useEntityStore.getState().journalsByDate) {
    await useEntityStore.getState().loadJournalForDate(date)
  }
}

// ---- Start / stop -----------------------------------------------------------

// A full reconcile can touch many records — each one used to mean a
// sequential await (a network round trip for the push, a Web Crypto op for
// the decrypt), so a device with a non-trivial history took visibly long to
// resync. Two changes fix that: every record's decrypt-or-build-envelope
// work runs concurrently via Promise.all instead of one-at-a-time in a
// for-of loop, and every collection's outgoing writes are collected into a
// single multi-path update() instead of one set() per record — turning what
// could be dozens of round trips into one.
async function buildEnvelopeSafely(record, masterKey, path, buildPayload, updates) {
  try {
    const envelope = await buildEnvelope(record, masterKey)
    updates[path] = buildPayload(envelope)
  } catch (err) {
    console.warn('[sync] failed to push a record — skipping it', err)
  }
}

// pullOnly skips every local -> cloud write (used when this device's local
// data belongs to another account — see start / OwnerMismatchError): the
// cloud is still fully pulled down and merged, and locally-tombstoned ids are
// still deleted locally, but nothing local is pushed up.
async function reconcileAll(uid, masterKey, { pullOnly = false } = {}) {
  const stats = { attempts: 0, successes: 0 }
  const [itemsSnap, instancesSnap, categoriesSnap, journalsSnap, deletedItemsSnap, deletedInstancesSnap] =
    await Promise.all([
      get(ref(rtdb, itemsPath(uid))),
      get(ref(rtdb, instancesPath(uid))),
      get(ref(rtdb, categoriesPath(uid))),
      get(ref(rtdb, journalsPath(uid))),
      get(ref(rtdb, deletedItemsPath(uid))),
      get(ref(rtdb, deletedInstancesPath(uid))),
    ])
  // Handed back to start() so attachListeners can ignore the replay burst
  // Firebase fires for every existing child the moment a listener attaches —
  // every id already accounted for here was just fully reconciled above, so
  // reprocessing it again per-record (a decrypt + IndexedDB read, or for a
  // tombstone a full store reload) the instant listeners go live is pure
  // redundant work. Only ids that show up *after* this snapshot are new.
  const knownIds = {
    itemIds: new Set(itemsSnap.exists() ? Object.keys(itemsSnap.val()) : []),
    instanceIds: new Set(instancesSnap.exists() ? Object.keys(instancesSnap.val()) : []),
    categoryIds: new Set(categoriesSnap.exists() ? Object.keys(categoriesSnap.val()) : []),
    journalDates: new Set(journalsSnap.exists() ? Object.keys(journalsSnap.val()) : []),
    deletedItemIds: new Set(deletedItemsSnap.exists() ? Object.keys(deletedItemsSnap.val()) : []),
    deletedInstanceIds: new Set(deletedInstancesSnap.exists() ? Object.keys(deletedInstancesSnap.val()) : []),
  }
  // Ids tombstoned by any device's real delete (see deleteItemRemote /
  // deleteInstanceRemote) — a local copy of one of these gets deleted here
  // rather than pushed back up, which is what used to resurrect a
  // deleted-on-another-device item/instance.
  const deletedItemIds = new Set(deletedItemsSnap.exists() ? Object.keys(deletedItemsSnap.val()) : [])
  const deletedInstanceIds = new Set(deletedInstancesSnap.exists() ? Object.keys(deletedInstancesSnap.val()) : [])

  const remoteItems = itemsSnap.exists() ? itemsSnap.val() : {}
  const localItems = await localRepo.getAllItems()
  const localItemsById = new Map(localItems.map((i) => [i.id, i]))

  await Promise.all(
    Object.entries(remoteItems)
      .filter(([id, record]) => {
        if (deletedItemIds.has(id)) return false
        const local = localItemsById.get(id)
        return !local || record.updatedAt > local.updatedAt
      })
      .map(async ([, record]) => {
        const opened = await tryOpenEnvelope(record, masterKey, stats)
        if (opened.ok) await localRepo.saveItem(opened.value, { preserveTimestamp: true })
      })
  )

  const itemUpdates = {}
  await Promise.all(
    localItems.map(async (item) => {
      if (deletedItemIds.has(item.id)) return localRepo.deleteItem(item.id)
      if (pullOnly || !item.syncEnabled) return
      const record = remoteItems[item.id]
      if (!record || item.updatedAt > record.updatedAt) {
        await buildEnvelopeSafely(item, masterKey, `${itemsPath(uid)}/${item.id}`, (envelope) => ({
          updatedAt: resolveUpdatedAt(item),
          ...envelope,
        }), itemUpdates)
      }
    })
  )
  if (Object.keys(itemUpdates).length > 0) await update(ref(rtdb), itemUpdates)

  const remoteInstances = instancesSnap.exists() ? instancesSnap.val() : {}
  const localInstances = await localRepo.getAllInstances()
  const localInstancesById = new Map(localInstances.map((i) => [i.id, i]))
  // Re-read items in case the block above created or deleted any locally.
  const itemsById = new Map((await localRepo.getAllItems()).map((i) => [i.id, i]))

  await Promise.all(
    Object.entries(remoteInstances)
      .filter(([id, record]) => {
        if (deletedInstanceIds.has(id)) return false
        const local = localInstancesById.get(id)
        return !local || record.updatedAt > local.updatedAt
      })
      .map(async ([, record]) => {
        const opened = await tryOpenEnvelope(record, masterKey, stats)
        if (opened.ok) await localRepo.saveInstance(opened.value, { preserveTimestamp: true })
      })
  )

  const instanceUpdates = {}
  await Promise.all(
    localInstances.map(async (instance) => {
      if (deletedInstanceIds.has(instance.id)) return localRepo.deleteInstance(instance.id)
      const parent = itemsById.get(instance.itemId)
      if (pullOnly || !parent?.syncEnabled) return
      const record = remoteInstances[instance.id]
      if (!record || instance.updatedAt > record.updatedAt) {
        await buildEnvelopeSafely(instance, masterKey, `${instancesPath(uid)}/${instance.id}`, (envelope) => ({
          itemId: instance.itemId,
          updatedAt: resolveUpdatedAt(instance),
          ...envelope,
        }), instanceUpdates)
      }
    })
  )
  if (Object.keys(instanceUpdates).length > 0) await update(ref(rtdb), instanceUpdates)

  const remoteCategories = categoriesSnap.exists() ? categoriesSnap.val() : {}
  const localCategories = await localRepo.getAllCategories()
  const localCategoriesById = new Map(localCategories.map((c) => [c.id, c]))

  await Promise.all(
    Object.entries(remoteCategories)
      .filter(([id, record]) => {
        const local = localCategoriesById.get(id)
        return !local || record.updatedAt > local.updatedAt
      })
      .map(async ([, record]) => {
        const opened = await tryOpenEnvelope(record, masterKey, stats)
        if (opened.ok) await localRepo.saveCategory(opened.value, { preserveTimestamp: true })
      })
  )

  const categoryUpdates = {}
  await Promise.all(
    localCategories.map(async (category) => {
      if (pullOnly) return
      const record = remoteCategories[category.id]
      if (!record || category.updatedAt > record.updatedAt) {
        await buildEnvelopeSafely(category, masterKey, `${categoriesPath(uid)}/${category.id}`, (envelope) => ({
          updatedAt: resolveUpdatedAt(category),
          ...envelope,
        }), categoryUpdates)
      }
    })
  )
  if (Object.keys(categoryUpdates).length > 0) await update(ref(rtdb), categoryUpdates)

  const remoteJournals = journalsSnap.exists() ? journalsSnap.val() : {}
  const localJournals = await localRepo.getAllJournals()
  const localJournalsByDate = new Map(localJournals.map((j) => [j.date, j]))

  await Promise.all(
    Object.entries(remoteJournals)
      .filter(([date, record]) => {
        const local = localJournalsByDate.get(date)
        return !local || record.updatedAt > local.updatedAt
      })
      .map(async ([, record]) => {
        const opened = await tryOpenEnvelope(record, masterKey, stats)
        if (opened.ok) await localRepo.saveJournal(opened.value, { preserveTimestamp: true })
      })
  )

  const journalUpdates = {}
  await Promise.all(
    localJournals.map(async (journal) => {
      if (pullOnly) return
      const record = remoteJournals[journal.date]
      if (!record || journal.updatedAt > record.updatedAt) {
        await buildEnvelopeSafely(journal, masterKey, `${journalsPath(uid)}/${journal.date}`, (envelope) => ({
          updatedAt: resolveUpdatedAt(journal),
          ...envelope,
        }), journalUpdates)
      }
    })
  )
  if (Object.keys(journalUpdates).length > 0) await update(ref(rtdb), journalUpdates)

  // Every decrypt attempt failing (with at least one attempted) means the
  // master key itself is wrong, not that a handful of records are corrupt —
  // surface that as a real error so unlock() treats it as a bad password
  // instead of silently "succeeding" with nothing actually synced.
  if (stats.attempts > 0 && stats.successes === 0) {
    throw new Error('Could not decrypt any synced data — the password is likely incorrect.')
  }

  useEntityStore.getState().refreshItems()
  await useEntityStore.getState().refreshAllInstances()
  await useEntityStore.getState().reloadLoadedDates()
  useEntityStore.getState().refreshCategories()
  const loadedJournalDates = Object.keys(useEntityStore.getState().journalsByDate)
  await Promise.all(loadedJournalDates.map((d) => useEntityStore.getState().loadJournalForDate(d)))

  return knownIds
}

// `knownIds` (see reconcileAll) lets each handler skip the initial replay
// burst — onChildAdded fires once per already-existing child the instant a
// listener attaches, on top of whatever reconcileAll just did for that same
// record. Ids first seen after that point (genuinely new/changed since the
// reconcile snapshot was taken) still go through the normal merge path.
function attachListeners(uid, knownIds) {
  const itemsR = ref(rtdb, itemsPath(uid))
  const instancesR = ref(rtdb, instancesPath(uid))
  const categoriesR = ref(rtdb, categoriesPath(uid))
  const journalsR = ref(rtdb, journalsPath(uid))
  const deletedItemsR = ref(rtdb, deletedItemsPath(uid))
  const deletedInstancesR = ref(rtdb, deletedInstancesPath(uid))

  detachFns.push(onChildAdded(itemsR, (snap) => { if (!knownIds.itemIds.has(snap.key)) mergeRemoteItem(snap.key, snap.val()) }))
  detachFns.push(onChildChanged(itemsR, (snap) => mergeRemoteItem(snap.key, snap.val())))
  detachFns.push(onChildAdded(instancesR, (snap) => { if (!knownIds.instanceIds.has(snap.key)) mergeRemoteInstance(snap.key, snap.val()) }))
  detachFns.push(onChildChanged(instancesR, (snap) => mergeRemoteInstance(snap.key, snap.val())))
  detachFns.push(onChildAdded(categoriesR, (snap) => { if (!knownIds.categoryIds.has(snap.key)) mergeRemoteCategory(snap.key, snap.val()) }))
  detachFns.push(onChildChanged(categoriesR, (snap) => mergeRemoteCategory(snap.key, snap.val())))
  detachFns.push(onChildRemoved(categoriesR, (snap) => removeRemoteCategory(snap.key)))
  detachFns.push(onChildAdded(journalsR, (snap) => { if (!knownIds.journalDates.has(snap.key)) mergeRemoteJournal(snap.key, snap.val()) }))
  detachFns.push(onChildChanged(journalsR, (snap) => mergeRemoteJournal(snap.key, snap.val())))
  detachFns.push(onChildAdded(deletedItemsR, (snap) => { if (!knownIds.deletedItemIds.has(snap.key)) handleRemoteItemDeleted(snap.key) }))
  detachFns.push(onChildAdded(deletedInstancesR, (snap) => { if (!knownIds.deletedInstanceIds.has(snap.key)) handleRemoteInstanceDeleted(snap.key) }))
}

// IndexedDB is one shared local database per browser, not one per signed-in
// account — it has no idea which Firebase account "owns" whatever's
// currently sitting in it. Without this check, signing into a second
// account on a browser that already has a different account's local data
// would silently push that data into the new account's cloud storage.
// Tracked in localStorage (travels with the browser, not the sync engine's
// in-memory state) so it survives reloads and is checked before every sync.
const LOCAL_OWNER_KEY = 'plannerapp:localDataOwnerUid'

function getLocalDataOwnerUid() {
  try {
    return localStorage.getItem(LOCAL_OWNER_KEY)
  } catch {
    return null
  }
}

function setLocalDataOwnerUid(uid) {
  try {
    localStorage.setItem(LOCAL_OWNER_KEY, uid)
  } catch {
    // Not fatal — worst case this check just can't run next time either.
  }
}

export class OwnerMismatchError extends Error {
  constructor() {
    super("This device's local data was last synced under a different account.")
    this.name = 'OwnerMismatchError'
  }
}

// On an owner mismatch (this browser's local data was last synced under a
// different account) sync still starts, but in pullOnly mode: the signed-in
// account's cloud data is pulled down and merged onto the screen and stays
// live via the listeners, while nothing local is ever pushed up and the
// local-owner marker is left untouched. OwnerMismatchError is still thrown
// afterwards so the store can surface "adopt this device?" (forceSyncThisDevice),
// but by then the user is already looking at their real cloud data instead of
// a warning banner. `force: true` (the explicit adopt) does the normal
// two-way reconcile and claims the marker.
export async function start(uid, masterKey, { force = false } = {}) {
  if (!firebaseEnabled) return
  const localOwner = getLocalDataOwnerUid()
  const pullOnly = !force && Boolean(localOwner) && localOwner !== uid
  stop()
  state = { uid, masterKey, pullOnly }
  const knownIds = await reconcileAll(uid, masterKey, { pullOnly })
  if (!pullOnly) setLocalDataOwnerUid(uid)
  attachListeners(uid, knownIds)
  if (pullOnly) throw new OwnerMismatchError()
}

export function stop() {
  for (const detach of detachFns) detach()
  detachFns = []
  state = null
}

// Manual full reconcile for an already-active sync session — e.g. a "resync"
// button for when a live listener update didn't make it across for whatever
// reason (missed connection, tab was asleep, etc.) and the two devices have
// drifted. Does not touch the live listeners or the owner-mismatch check,
// both already settled when sync started; just re-runs the same push/pull
// pass start() does on its way up.
export async function resync() {
  if (!state || !firebaseEnabled) return
  await reconcileAll(state.uid, state.masterKey, { pullOnly: state.pullOnly })
}

export function isSyncing() {
  return state !== null
}
