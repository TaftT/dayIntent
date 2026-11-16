import { getDb } from './db.js'
import * as repo from './index.js'

// Full-data backup: one JSON file with every record this device holds
// (including archived items, which carry finalized history). The file is
// plain, unencrypted text — it is the user's own copy, so it is readable
// without the app.

export const BACKUP_APP = 'dayintent'
export const BACKUP_VERSION = 1
const MAX_BACKUP_BYTES = 100 * 1024 * 1024

const STORES = ['categories', 'groups', 'items', 'instances', 'journals', 'weatherDays']
const KEY_OF = { journals: 'date' } // every other store is keyed by `id`
const keyOf = (store) => KEY_OF[store] ?? 'id'

export class BackupError extends Error {
  constructor(message) {
    super(message)
    this.name = 'BackupError'
  }
}

/** @returns {Promise<object>} the backup document, ready for JSON.stringify */
export async function exportBackup() {
  const db = await getDb()
  const data = {}
  for (const store of STORES) data[store] = await db.getAll(store)
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: new Date().toISOString(), data }
}

/** Counts per collection, for the "what's in this file" preview. */
export function summarize(doc) {
  return Object.fromEntries(STORES.map((s) => [s, doc.data[s].length]))
}

/** Parses and validates backup text. @throws {BackupError} for anything that isn't a usable DayIntent backup. */
export function parseBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BACKUP_BYTES) throw new BackupError('That file is too large to be a DayIntent backup.')
  let doc
  try {
    doc = JSON.parse(text)
  } catch {
    throw new BackupError('That file is not valid JSON, so it can’t be a DayIntent backup.')
  }
  if (!doc || doc.app !== BACKUP_APP || typeof doc.version !== 'number' || typeof doc.data !== 'object' || doc.data === null) {
    throw new BackupError('That file is not a DayIntent backup.')
  }
  if (doc.version > BACKUP_VERSION) {
    throw new BackupError('This backup was made by a newer version of DayIntent. Update the app and try again.')
  }
  const data = {}
  for (const store of STORES) {
    const list = doc.data[store] ?? []
    if (!Array.isArray(list)) throw new BackupError(`The backup’s "${store}" section is damaged.`)
    // Drop anything that can't be stored (no key) rather than failing the whole import.
    data[store] = list.filter((r) => r && typeof r === 'object' && typeof r[keyOf(store)] === 'string' && r[keyOf(store)])
  }
  return { ...doc, data }
}

/**
 * Applies a parsed backup to this device. Nothing is ever deleted.
 *  - 'merge':   adds what is missing and updates a record only when the file's
 *               copy is newer (by updatedAt). Safe to run any time.
 *  - 'restore': every record in the file replaces the local one and is stamped
 *               "now", so it also wins over the cloud on the next sync. Use it
 *               to roll back to the file.
 * Writes go through the normal repository, so synced items reach the cloud the
 * usual way (a merge keeps the file's own timestamps, so it can never overwrite
 * a newer cloud copy).
 * @returns {Promise<{added: number, updated: number, unchanged: number}>}
 */
export async function importBackup(doc, { mode = 'merge' } = {}) {
  if (mode !== 'merge' && mode !== 'restore') throw new BackupError('Unknown import mode.')
  const db = await getDb()
  const keepStamp = mode === 'merge' ? { preserveTimestamp: true } : undefined
  // Parents before children, so an instance's item exists when it is saved.
  const writers = {
    categories: (r) => repo.saveCategory(r, keepStamp),
    groups: (r) => repo.saveGroup(r, keepStamp),
    items: (r) => repo.saveItem(r, keepStamp),
    instances: (r) => repo.saveInstance(r, keepStamp),
    journals: (r) => repo.saveJournal(r, keepStamp),
    weatherDays: (r) => repo.saveWeatherDay(r, keepStamp),
  }
  const result = { added: 0, updated: 0, unchanged: 0 }
  for (const store of STORES) {
    for (const record of doc.data[store]) {
      const local = await db.get(store, record[keyOf(store)])
      if (!local) {
        await writers[store](record)
        result.added++
      } else if (mode === 'restore' || (record.updatedAt ?? '') > (local.updatedAt ?? '')) {
        await writers[store](record)
        result.updated++
      } else {
        result.unchanged++
      }
    }
  }
  return result
}
