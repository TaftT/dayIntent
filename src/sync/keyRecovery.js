// Forgotten-password recovery for the end-to-end encrypted cloud data.
//
// The master key is normally PBKDF2(password, salt), so a new password (e.g.
// after a reset email) derives a DIFFERENT key and can't open existing data.
// Two small records under users/$uid/meta fix that without touching any item:
//
//   recovery = the master key's raw bytes, encrypted with a random recovery key
//              the user writes down (never stored anywhere). Created on demand
//              while the user still knows their password.
//   keyWrap  = the same raw bytes, encrypted with a key derived from the CURRENT
//              password. Absent for ordinary accounts (master key = password key).
//              Written when a recovery key is redeemed, so the new password
//              opens the original master key from then on.
//
// Cloud records are never re-encrypted: they stay under the original master key.

import { ref, get, set, runTransaction } from 'firebase/database'
import { rtdb } from '../firebase/config.js'
import {
  deriveMasterKey,
  deriveMasterBits,
  importMasterKey,
  generateRecoveryKey,
  deriveRecoveryKey,
  isValidRecoveryKey,
  wrapRaw,
  unwrapRaw,
} from '../firebase/crypto.js'
import { getOrCreateSalt, verifyMasterKey, withTimeout, WrongKeyError } from './syncEngine.js'

const recoveryPath = (uid) => `users/${uid}/meta/recovery`
const keyWrapPath = (uid) => `users/${uid}/meta/keyWrap`

export class BadRecoveryKeyError extends Error {
  constructor(message = 'That recovery key is not right. Check it and try again.') {
    super(message)
    this.name = 'BadRecoveryKeyError'
  }
}

export class NoRecoveryKeyError extends Error {
  constructor() {
    super('No recovery key was ever set up for this account, so the encrypted data cannot be recovered.')
    this.name = 'NoRecoveryKeyError'
  }
}

/** Raw master-key bytes for this password, or null when it doesn't unwrap the stored keyWrap. */
async function rawMasterFor(uid, password) {
  const salt = await getOrCreateSalt(uid)
  const snap = await withTimeout(get(ref(rtdb, keyWrapPath(uid))))
  if (snap.exists()) {
    try {
      return await unwrapRaw(snap.val(), await deriveMasterKey(password, salt))
    } catch {
      return null
    }
  }
  return deriveMasterBits(password, salt)
}

/**
 * The master key a password opens: the stored keyWrap's key when one exists,
 * otherwise the plain password-derived key (every account that never recovered).
 */
export async function resolveMasterKey(uid, password) {
  const raw = await rawMasterFor(uid, password)
  if (!raw) throw new WrongKeyError()
  return importMasterKey(raw)
}

export async function hasRecoveryKey(uid) {
  return (await get(ref(rtdb, recoveryPath(uid)))).exists()
}

/**
 * Creates (or replaces) the recovery key. Needs the current password to read the
 * master key's bytes, and checks them against the cloud before storing anything.
 * @returns {Promise<string>} the recovery key to show the user once
 */
export async function createRecoveryKey(uid, password) {
  const raw = await rawMasterFor(uid, password)
  if (!raw) throw new WrongKeyError()
  await verifyMasterKey(uid, await importMasterKey(raw)) // throws WrongKeyError if it isn't the real key
  const recoveryKey = generateRecoveryKey()
  await set(ref(rtdb, recoveryPath(uid)), await wrapRaw(raw, await deriveRecoveryKey(recoveryKey)))
  return recoveryKey
}

/**
 * Redeems a recovery key: recovers the original master key and binds it to
 * `newPassword` (the account's current password) so ordinary sign-in works again.
 * @returns {Promise<CryptoKey>} the master key to start sync with
 */
export async function redeemRecoveryKey(uid, recoveryKey, newPassword) {
  if (!isValidRecoveryKey(recoveryKey)) throw new BadRecoveryKeyError('A recovery key has 32 letters and digits (A–Z, 2–7).')
  const snap = await get(ref(rtdb, recoveryPath(uid)))
  if (!snap.exists()) throw new NoRecoveryKeyError()

  let raw
  try {
    raw = await unwrapRaw(snap.val(), await deriveRecoveryKey(recoveryKey))
  } catch {
    throw new BadRecoveryKeyError()
  }
  const masterKey = await importMasterKey(raw)
  await verifyMasterKey(uid, masterKey)

  const salt = await getOrCreateSalt(uid)
  const passwordKey = await deriveMasterKey(newPassword, salt)
  const keyWrap = await wrapRaw(raw, passwordKey)
  await runTransaction(ref(rtdb, keyWrapPath(uid)), () => keyWrap, { applyLocally: false })
  return masterKey
}
