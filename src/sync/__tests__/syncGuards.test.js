import { describe, it, expect, beforeEach, vi } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'

// ---- In-memory stand-in for the Realtime Database -------------------------
const fake = vi.hoisted(() => {
  const f = { tree: {}, gate: null }
  const parts = (p) => String(p).split('/').filter(Boolean)
  f.read = (path) => parts(path).reduce((n, k) => (n == null ? n : n[k]), f.tree) ?? null
  f.write = (path, value) => {
    const ks = parts(path)
    if (ks.length === 0) return
    let n = f.tree
    for (const k of ks.slice(0, -1)) n = n[k] ??= {}
    if (value === null || value === undefined) delete n[ks.at(-1)]
    else n[ks.at(-1)] = JSON.parse(JSON.stringify(value))
  }
  return f
})

vi.mock('../../firebase/config.js', () => ({ rtdb: {}, auth: null, firebaseEnabled: true }))
vi.mock('firebase/database', () => {
  const snap = (v, key) => ({
    exists: () => v != null,
    val: () => v,
    key,
    forEach: (cb) => Object.entries(v ?? {}).forEach(([k, c]) => cb({ key: k, val: () => c })),
  })
  return {
    ref: (_db, path = '') => ({ path }),
    get: async (r) => {
      if (fake.gate) await fake.gate
      let v = fake.read(r.path)
      if (r.limit && v) v = Object.fromEntries(Object.entries(v).slice(0, r.limit))
      return snap(v, r.path.split('/').pop())
    },
    query: (r, c) => ({ ...r, ...c }),
    limitToFirst: (n) => ({ limit: n }),
    set: async (r, v) => fake.write(r.path, v),
    remove: async (r) => fake.write(r.path, null),
    update: async (r, updates) => Object.entries(updates).forEach(([p, v]) => fake.write(`${r.path}/${p}`, v)),
    runTransaction: async (r, fn) => {
      const next = fn(fake.read(r.path))
      if (next !== undefined) fake.write(r.path, next)
      return { committed: next !== undefined }
    },
    onChildAdded: () => () => {},
    onChildChanged: () => () => {},
    onChildRemoved: () => () => {},
  }
})

import { _resetDbForTests } from '../../data/db.js'
import * as localRepo from '../../data/indexedDbRepository.js'
import { deriveMasterKey, generateSalt, generateDataKey, wrapKey, encryptJson, decryptJson, unwrapKey } from '../../firebase/crypto.js'
import { start, stop, pushInstance, WrongKeyError } from '../syncEngine.js'

const UID = 'u1'
let masterKey

async function envelope(payload) {
  const dataKey = await generateDataKey()
  const { wrappedKey, keyIv } = await wrapKey(dataKey, masterKey)
  const { ciphertext, iv } = await encryptJson(payload, dataKey)
  return { wrappedKey, keyIv, ciphertext, iv }
}
async function cloudInstance(id) {
  const rec = fake.read(`users/${UID}/instances/${id}`)
  const dataKey = await unwrapKey(rec.wrappedKey, rec.keyIv, masterKey)
  return { rec, value: await decryptJson({ ciphertext: rec.ciphertext, iv: rec.iv }, dataKey) }
}

const OLD = '2026-10-31T10:00:00.000Z'
const NEW = '2026-11-01T10:00:00.000Z'

beforeEach(async () => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  fake.tree = {}
  fake.gate = null
  localStorage.clear()
  masterKey = await deriveMasterKey('pw', generateSalt())
  stop()
})

// The cloud holds a completed instance (phone); the desktop's local copy is a
// stale, uncompleted one of the same instance.
async function seed() {
  const item = await localRepo.saveItem({ title: 'Task', syncEnabled: true })
  const stale = await localRepo.saveInstance(
    { itemId: item.id, date: '2026-11-01', percentComplete: 0, updatedAt: OLD },
    { preserveTimestamp: true },
  )
  const completed = { ...stale, percentComplete: 100, finalized: true, status: 'completed', updatedAt: NEW }
  fake.write(`users/${UID}/instances/${stale.id}`, {
    itemId: item.id,
    updatedAt: NEW,
    ...(await envelope(completed)),
  })
  return { item, stale }
}

describe('sync push guards', () => {
  it('does not let a push replace a newer cloud copy (compare-and-set)', async () => {
    const { stale } = await seed()
    await start(UID, masterKey)
    // A stale write that somehow carries an older timestamp must lose.
    await pushInstance({ ...stale, percentComplete: 0, updatedAt: OLD }, true)
    expect((await cloudInstance(stale.id)).value.percentComplete).toBe(100)
  })

  it('still lets a genuine newer edit through', async () => {
    const { stale } = await seed()
    await start(UID, masterKey)
    await pushInstance({ ...stale, percentComplete: 40, updatedAt: '2026-11-02T10:00:00.000Z' }, true)
    expect((await cloudInstance(stale.id)).value.percentComplete).toBe(40)
  })

  it('holds back local writes made before the first reconcile finishes', async () => {
    const { stale } = await seed()
    let release
    fake.gate = new Promise((r) => (release = r))
    const started = start(UID, masterKey)
    // Mid-reconcile (cloud not yet read): even a write stamped "now" must not go up.
    await pushInstance({ ...stale, percentComplete: 0, updatedAt: '2026-12-01T00:00:00.000Z' }, true)
    expect((await cloudInstance(stale.id)).value.percentComplete).toBe(100)
    fake.gate = null
    release()
    await started
    // Reconcile pulled the cloud's completed copy down onto this device.
    expect((await localRepo.getInstance(stale.id)).percentComplete).toBe(100)
  })
})

describe('key verifier', () => {
  const verifier = () => fake.read(`users/${UID}/meta/verifier`)

  it('refuses a wrong key before writing anything, and leaves sync disarmed', async () => {
    const { stale } = await seed()
    const wrong = await deriveMasterKey('not-the-password', generateSalt())
    const before = JSON.stringify(fake.tree)

    await expect(start(UID, wrong)).rejects.toBeInstanceOf(WrongKeyError)
    expect(JSON.stringify(fake.tree)).toBe(before) // nothing written, no verifier planted

    // A later local save must not reach the cloud under the wrong key.
    await pushInstance({ ...stale, percentComplete: 5, updatedAt: '2099-01-01T00:00:00.000Z' }, true)
    expect(JSON.stringify(fake.tree)).toBe(before)
  })

  it('creates the verifier for an existing account on its first correct unlock', async () => {
    await seed()
    expect(verifier()).toBeNull()
    await start(UID, masterKey)
    expect(verifier()).not.toBeNull()
  })

  it('after the verifier exists, rejects a wrong key even on an otherwise empty cloud read', async () => {
    await start(UID, masterKey) // fresh account: defines the verifier
    expect(verifier()).not.toBeNull()
    stop()
    const wrong = await deriveMasterKey('other', generateSalt())
    await expect(start(UID, wrong)).rejects.toBeInstanceOf(WrongKeyError)
    await expect(start(UID, masterKey)).resolves.toBeUndefined()
  })
})
