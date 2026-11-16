import { describe, it, expect, beforeEach, vi } from 'vitest'

const fake = vi.hoisted(() => {
  const f = { tree: {} }
  const parts = (p) => String(p).split('/').filter(Boolean)
  f.read = (path) => parts(path).reduce((n, k) => (n == null ? n : n[k]), f.tree) ?? null
  f.write = (path, value) => {
    const ks = parts(path)
    let n = f.tree
    for (const k of ks.slice(0, -1)) n = n[k] ??= {}
    if (value == null) delete n[ks.at(-1)]
    else n[ks.at(-1)] = JSON.parse(JSON.stringify(value))
  }
  return f
})

vi.mock('../../firebase/config.js', () => ({ rtdb: {}, auth: null, firebaseEnabled: true }))
vi.mock('firebase/database', () => {
  const snap = (v) => ({
    exists: () => v != null,
    val: () => v,
    forEach: (cb) => Object.entries(v ?? {}).forEach(([k, c]) => cb({ key: k, val: () => c })),
  })
  return {
    ref: (_db, path = '') => ({ path }),
    get: async (r) => {
      let v = fake.read(r.path)
      if (r.limit && v) v = Object.fromEntries(Object.entries(v).slice(0, r.limit))
      return snap(v)
    },
    query: (r, c) => ({ ...r, ...c }),
    limitToFirst: (n) => ({ limit: n }),
    set: async (r, v) => fake.write(r.path, v),
    remove: async (r) => fake.write(r.path, null),
    update: async () => {},
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

import {
  generateRecoveryKey,
  isValidRecoveryKey,
  normalizeRecoveryKey,
  generateDataKey,
  wrapKey,
  unwrapKey,
  encryptJson,
  decryptJson,
} from '../../firebase/crypto.js'
import { WrongKeyError } from '../syncEngine.js'
import {
  resolveMasterKey,
  createRecoveryKey,
  redeemRecoveryKey,
  hasRecoveryKey,
  BadRecoveryKeyError,
  NoRecoveryKeyError,
} from '../keyRecovery.js'

const UID = 'u1'

async function seal(payload, key) {
  const dataKey = await generateDataKey()
  const { wrappedKey, keyIv } = await wrapKey(dataKey, key)
  const { ciphertext, iv } = await encryptJson(payload, dataKey)
  return { wrappedKey, keyIv, ciphertext, iv }
}
async function open(record, key) {
  return decryptJson(record, await unwrapKey(record.wrappedKey, record.keyIv, key))
}

beforeEach(() => {
  fake.tree = {}
})

describe('recovery key format', () => {
  it('is 32 base32 characters in groups of four and tolerant of typing', () => {
    const k = generateRecoveryKey()
    expect(k).toMatch(/^([A-Z2-7]{4}-){7}[A-Z2-7]{4}$/)
    expect(isValidRecoveryKey(k.toLowerCase().replaceAll('-', ' '))).toBe(true)
    expect(normalizeRecoveryKey(k)).toHaveLength(32)
    expect(isValidRecoveryKey('ABCD')).toBe(false)
  })
})

describe('forgotten-password recovery', () => {
  // The account's data was sealed under the key from the ORIGINAL password.
  async function accountWithData(password = 'old-pass') {
    const key = await resolveMasterKey(UID, password)
    fake.write(`users/${UID}/categories/c1`, await seal({ name: 'Health' }, key))
    fake.write(`users/${UID}/meta/verifier`, await seal({ check: 'dayintent-key-check' }, key))
    return key
  }

  it('an account without recovery set up cannot open its data with a new password', async () => {
    await accountWithData('old-pass')
    const other = await resolveMasterKey(UID, 'new-pass') // derives a different key
    await expect(open(fake.read(`users/${UID}/categories/c1`), other)).rejects.toBeTruthy()
    await expect(redeemRecoveryKey(UID, generateRecoveryKey(), 'new-pass')).rejects.toBeInstanceOf(NoRecoveryKeyError)
  })

  it('a recovery key opens the original data under a new password', async () => {
    await accountWithData('old-pass')
    expect(await hasRecoveryKey(UID)).toBe(false)
    const recoveryKey = await createRecoveryKey(UID, 'old-pass')
    expect(await hasRecoveryKey(UID)).toBe(true)

    // Password forgotten and reset: redeem with the key + the new password.
    const key = await redeemRecoveryKey(UID, recoveryKey.toLowerCase(), 'new-pass')
    expect(await open(fake.read(`users/${UID}/categories/c1`), key)).toEqual({ name: 'Health' })

    // From now on the new password alone opens the same data…
    const later = await resolveMasterKey(UID, 'new-pass')
    expect(await open(fake.read(`users/${UID}/categories/c1`), later)).toEqual({ name: 'Health' })
    // …and the old one no longer maps to it.
    await expect(resolveMasterKey(UID, 'old-pass')).rejects.toBeInstanceOf(WrongKeyError)
    // The recovery key keeps working for another reset.
    const again = await redeemRecoveryKey(UID, recoveryKey, 'third-pass')
    expect(await open(fake.read(`users/${UID}/categories/c1`), again)).toEqual({ name: 'Health' })
  })

  it('rejects a wrong recovery key and writes nothing', async () => {
    await accountWithData('old-pass')
    await createRecoveryKey(UID, 'old-pass')
    await expect(redeemRecoveryKey(UID, generateRecoveryKey(), 'new-pass')).rejects.toBeInstanceOf(BadRecoveryKeyError)
    await expect(redeemRecoveryKey(UID, 'nope', 'new-pass')).rejects.toBeInstanceOf(BadRecoveryKeyError)
    expect(fake.read(`users/${UID}/meta/keyWrap`)).toBeNull()
  })

  it('refuses to create a recovery key with the wrong password', async () => {
    await accountWithData('old-pass')
    await expect(createRecoveryKey(UID, 'not-it')).rejects.toBeInstanceOf(WrongKeyError)
    expect(fake.read(`users/${UID}/meta/recovery`)).toBeNull()
  })

  it('a new recovery key replaces the old one', async () => {
    await accountWithData('old-pass')
    const first = await createRecoveryKey(UID, 'old-pass')
    const second = await createRecoveryKey(UID, 'old-pass')
    await expect(redeemRecoveryKey(UID, first, 'x-pass-1')).rejects.toBeInstanceOf(BadRecoveryKeyError)
    await expect(redeemRecoveryKey(UID, second, 'x-pass-1')).resolves.toBeTruthy()
  })
})
