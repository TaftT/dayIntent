// Remembers the master key across page refreshes so a signed-in user isn't
// asked for their password again on every reload.
//
// The key is a NON-EXTRACTABLE CryptoKey (see crypto.deriveMasterKey), so
// IndexedDB can persist it via structured clone without its raw bytes ever
// being readable by JS — page code (or an XSS) can still *use* it while the
// tab is open, same as the in-memory copy, but the key material can't be
// exported or copied off the device. It's cleared on sign-out. The password
// itself is never stored.

const DB_NAME = 'dayintent-keys'
const STORE = 'masterKeys'

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

async function withStore(mode, fn) {
  const db = await openDb()
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(STORE, mode)
      const req = fn(tx.objectStore(STORE))
      tx.oncomplete = () => resolve(req?.result)
      tx.onerror = () => reject(tx.error)
      tx.onabort = () => reject(tx.error)
    })
  } finally {
    db.close()
  }
}

// All helpers swallow errors: a missing/blocked key store just means the user
// gets the normal password prompt.
export async function saveMasterKey(uid, key) {
  try {
    await withStore('readwrite', (s) => s.put(key, uid))
  } catch { /* fall back to prompting */ }
}

export async function loadMasterKey(uid) {
  try {
    return (await withStore('readonly', (s) => s.get(uid))) ?? null
  } catch {
    return null
  }
}

export async function clearMasterKeys() {
  try {
    await withStore('readwrite', (s) => s.clear())
  } catch { /* nothing to do */ }
}
