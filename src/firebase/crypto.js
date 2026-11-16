// Envelope encryption for cloud-synced items:
//   masterKey  = PBKDF2(password, per-user salt)           — never leaves the device
//   dataKey    = random AES-256 key, one per item/instance — wrapped with masterKey before storage
//   payload    = the item/instance JSON, encrypted with its own dataKey
//
// Firebase (and anyone who can only read the database) sees ciphertext plus
// a wrapped data key it cannot unwrap without the user's password. Keeping a
// separate data key per record (rather than encrypting everything directly
// with masterKey) means a future "share this item" feature can wrap the same
// data key again for a recipient's key without touching any other record.

const PBKDF2_ITERATIONS = 600_000

function bytesToBase64(bytes) {
  let binary = ''
  const chunkSize = 0x8000
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize))
  }
  return btoa(binary)
}

function base64ToBytes(b64) {
  const binary = atob(b64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export function generateSalt() {
  return bytesToBase64(crypto.getRandomValues(new Uint8Array(16)))
}

function randomIv() {
  return crypto.getRandomValues(new Uint8Array(12))
}

/** @returns {Promise<CryptoKey>} a non-extractable AES-GCM 256 key derived from the password */
export async function deriveMasterKey(password, saltB64) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  )
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  )
}

/** The raw 32 bytes behind deriveMasterKey — only used to create/redeem a recovery key. */
export async function deriveMasterBits(password, saltB64) {
  const keyMaterial = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, [
    'deriveBits',
  ])
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: base64ToBytes(saltB64), iterations: PBKDF2_ITERATIONS, hash: 'SHA-256' },
    keyMaterial,
    256
  )
  return new Uint8Array(bits)
}

/** Turns raw master-key bytes back into the usual non-extractable master key. */
export function importMasterKey(raw) {
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

// ---- Recovery key -----------------------------------------------------------
// A random 160-bit code (base32, shown as XXXX-XXXX-…). It is never stored; it
// only encrypts a copy of the master key kept in the cloud, so someone who
// forgets their password can still open their data. 160 random bits need no
// slow key stretching, a plain SHA-256 is enough.
const RECOVERY_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'
const RECOVERY_CHARS = 32

export function generateRecoveryKey() {
  const bytes = crypto.getRandomValues(new Uint8Array(20))
  let bits = ''
  for (const b of bytes) bits += b.toString(2).padStart(8, '0')
  let out = ''
  for (let i = 0; i < bits.length; i += 5) out += RECOVERY_ALPHABET[parseInt(bits.slice(i, i + 5), 2)]
  return out.match(/.{4}/g).join('-')
}

/** Upper-cases and drops spaces/dashes so a hand-typed key still matches. */
export function normalizeRecoveryKey(text) {
  return String(text ?? '')
    .toUpperCase()
    .replace(/[^A-Z2-7]/g, '')
}

export function isValidRecoveryKey(text) {
  return normalizeRecoveryKey(text).length === RECOVERY_CHARS
}

export async function deriveRecoveryKey(text) {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(`dayintent-recovery:${normalizeRecoveryKey(text)}`)
  )
  return crypto.subtle.importKey('raw', digest, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

/** Encrypts raw key bytes under `wrappingKey`. */
export async function wrapRaw(raw, wrappingKey) {
  const iv = randomIv()
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrappingKey, raw)
  return { wrapped: bytesToBase64(new Uint8Array(wrapped)), iv: bytesToBase64(iv) }
}

/** @returns {Promise<Uint8Array>} the raw bytes; throws if `wrappingKey` is wrong */
export async function unwrapRaw({ wrapped, iv }, wrappingKey) {
  const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: base64ToBytes(iv) }, wrappingKey, base64ToBytes(wrapped))
  return new Uint8Array(raw)
}

/** @returns {Promise<CryptoKey>} a fresh, extractable per-record AES-GCM 256 data key */
export function generateDataKey() {
  return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt'])
}

/** Wraps a data key with the master key so it can be stored alongside the ciphertext it protects. */
export async function wrapKey(dataKey, masterKey) {
  const raw = await crypto.subtle.exportKey('raw', dataKey)
  const iv = randomIv()
  const wrapped = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, masterKey, raw)
  return { wrappedKey: bytesToBase64(new Uint8Array(wrapped)), keyIv: bytesToBase64(iv) }
}

/** @returns {Promise<CryptoKey>} the unwrapped, extractable data key */
export async function unwrapKey(wrappedKeyB64, keyIvB64, masterKey) {
  const raw = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(keyIvB64) },
    masterKey,
    base64ToBytes(wrappedKeyB64)
  )
  return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt'])
}

/** Encrypts a JSON-serializable object with a (per-record) data key. */
export async function encryptJson(obj, dataKey) {
  const iv = randomIv()
  const plaintext = new TextEncoder().encode(JSON.stringify(obj))
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, dataKey, plaintext)
  return { ciphertext: bytesToBase64(new Uint8Array(ciphertext)), iv: bytesToBase64(iv) }
}

/** @returns {Promise<any>} the decrypted, parsed object */
export async function decryptJson({ ciphertext, iv }, dataKey) {
  const plaintext = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: base64ToBytes(iv) },
    dataKey,
    base64ToBytes(ciphertext)
  )
  return JSON.parse(new TextDecoder().decode(plaintext))
}
