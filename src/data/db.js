import { openDB } from 'idb'

const DB_NAME = 'planner-app'
const DB_VERSION = 2

/** @type {Promise<import('idb').IDBPDatabase>|null} */
let dbPromise = null

export function getDb() {
  if (!dbPromise) {
    dbPromise = openDB(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const items = db.createObjectStore('items', { keyPath: 'id' })
          items.createIndex('isUnscheduled', 'isUnscheduled')
          items.createIndex('categoryId', 'categoryId')

          db.createObjectStore('categories', { keyPath: 'id' })

          const instances = db.createObjectStore('instances', { keyPath: 'id' })
          instances.createIndex('date', 'date')
          instances.createIndex('itemId', 'itemId')
          instances.createIndex('finalized', 'finalized')
          instances.createIndex('finalized_date', ['finalized', 'date'])

          db.createObjectStore('journals', { keyPath: 'date' })
        }
        // v2: backlog groups (named, colored, ordered) as their own records.
        if (oldVersion < 2) {
          db.createObjectStore('groups', { keyPath: 'id' })
        }
      },
    })
  }
  return dbPromise
}

/** Test-only helper to reset the cached connection between test files. */
export function _resetDbForTests() {
  dbPromise = null
}
