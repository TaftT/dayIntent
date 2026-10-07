import { create } from 'zustand'
import * as fbAuth from '../firebase/auth.js'
import { deriveMasterKey } from '../firebase/crypto.js'
import { saveMasterKey, loadMasterKey, clearMasterKeys } from '../firebase/keyStore.js'
import * as syncEngine from '../sync/syncEngine.js'
import { firebaseEnabled } from '../firebase/config.js'
import * as repo from '../data/index.js'
import { useEntityStore } from './useEntityStore.js'

// Auth is entirely optional — the app must work fully offline with no one
// signed in. masterKey is derived from the user's password on sign-in/unlock
// and held in memory; the non-extractable key (never the password) is also
// remembered in firebase/keyStore.js so a page refresh can restore it. If
// that's missing or stale, needsUnlock (below) surfaces a "re-enter your
// password" prompt.
let listenerAttached = false

export const useAuthStore = create((set, get) => ({
  ready: false, // true once the initial Firebase auth state has resolved
  user: null, // { uid, email } | null
  masterKey: null, // CryptoKey | null
  needsUnlock: false,
  syncing: false, // true while the initial reconcile (push/pull everything) is in flight
  // Set when this browser's local data was last synced under a different
  // account — see syncEngine.OwnerMismatchError. Sync runs in pull-only mode
  // in this state: the signed-in account's cloud data is pulled down and kept
  // live on screen, but nothing local is pushed up until the user either
  // adopts this device (forceSyncThisDevice) or signs out.
  ownerMismatch: false,
  pendingMasterKey: null, // held here only while ownerMismatch is true, for forceSyncThisDevice

  // Guarded against double-invocation (e.g. React StrictMode's double-effect
  // in dev) since it registers a listener as a side effect.
  init: () => {
    if (listenerAttached) return
    listenerAttached = true
    if (!firebaseEnabled) {
      set({ ready: true })
      return
    }
    fbAuth.onAuthStateChanged((user) => {
      if (user) {
        set({ user: { uid: user.uid, email: user.email }, ready: true, needsUnlock: !get().masterKey })
        if (!get().masterKey) get()._restoreSession(user.uid, user.email)
      } else {
        // Distinguish a real sign-out (was signed in, now not) from just
        // starting the app while signed out — only the former purges synced
        // items. Someone who never signs in must keep everything they've made
        // (their items default to syncEnabled: true).
        const wasSignedIn = get().user !== null
        syncEngine.stop()
        set({ user: null, masterKey: null, needsUnlock: false, ready: true, ownerMismatch: false, pendingMasterKey: null })
        if (wasSignedIn) {
          clearMasterKeys()
          get()._purgeSyncedOnSignOut()
        }
      }
    })
  },

  // On sign-out, removes the cloud-synced items/instances from this device so
  // no synced data is left sitting there un-editable. Local-only items
  // (syncEnabled: false) stay put — they're this device's own data and were
  // never in the cloud. Synced items come back on the next sign-in. Only ever
  // called on an actual sign-out (see the wasSignedIn guard), never on app
  // start while signed out.
  _purgeSyncedOnSignOut: async () => {
    await repo.purgeSyncedItems()
    const entities = useEntityStore.getState()
    await entities.refreshItems()
    await entities.refreshAllInstances()
    await entities.reloadLoadedDates()
  },

  // After a refresh the Firebase session survives but the in-memory key
  // doesn't — reuse the key remembered in keyStore so the user isn't asked for
  // their password again. If it's missing or no longer works (e.g. password
  // changed elsewhere), needsUnlock stays true and the normal prompt appears.
  _restoreSession: async (uid, email) => {
    const stored = await loadMasterKey(uid)
    if (!stored || get().masterKey || get().user?.uid !== uid) return
    try {
      await get()._completeSignIn(uid, email, stored)
    } catch {
      await clearMasterKeys()
      set({ masterKey: null, needsUnlock: true })
    }
  },

  // Shared by signUp/signIn/unlock: starts the sync engine and commits
  // masterKey/needsUnlock only once it actually succeeds. On an owner
  // mismatch, masterKey is still committed (the password itself was valid —
  // Firebase already checked it for signUp/signIn, and a decrypt-based
  // check would need the very sync we're refusing to run); syncEngine.start
  // has by then already pulled the cloud data down in pull-only mode, and
  // ownerMismatch is surfaced so the UI can offer to adopt this device.
  _completeSignIn: async (uid, email, masterKey) => {
    set({ user: { uid, email }, syncing: true, ownerMismatch: false, pendingMasterKey: null })
    try {
      await syncEngine.start(uid, masterKey)
      set({ masterKey, needsUnlock: false })
      saveMasterKey(uid, masterKey)
    } catch (err) {
      if (err instanceof syncEngine.OwnerMismatchError) {
        set({ masterKey, needsUnlock: false, ownerMismatch: true, pendingMasterKey: masterKey })
        saveMasterKey(uid, masterKey)
        return
      }
      throw err
    } finally {
      set({ syncing: false })
    }
  },

  signUp: async (email, password) => {
    const user = await fbAuth.signUp(email, password)
    const salt = await syncEngine.getOrCreateSalt(user.uid)
    const masterKey = await deriveMasterKey(password, salt)
    await get()._completeSignIn(user.uid, user.email, masterKey)
  },

  signIn: async (email, password) => {
    const user = await fbAuth.signIn(email, password)
    const salt = await syncEngine.getOrCreateSalt(user.uid)
    const masterKey = await deriveMasterKey(password, salt)
    await get()._completeSignIn(user.uid, user.email, masterKey)
  },

  // Re-derives the master key for an already-signed-in Firebase session
  // (e.g. after a page refresh) without asking for the email again, then
  // does a full two-way reconcile — pushes anything edited locally while
  // locked, and pulls anything that changed in the cloud (another device,
  // etc.) while this one was locked. `syncing` stays true for that whole
  // pass so the UI can show it's actually happening, not just assume it.
  //
  // masterKey/needsUnlock are only committed to the store AFTER start()
  // succeeds — reconcileAll will throw on a wrong password (it can't
  // decrypt existing cloud records with it), and committing them beforehand
  // would leave the UI reporting "unlocked" with a master key that's
  // actually useless, silently breaking sync until the next refresh.
  unlock: async (password) => {
    const { user } = get()
    if (!user) return
    const salt = await syncEngine.getOrCreateSalt(user.uid)
    const masterKey = await deriveMasterKey(password, salt)
    await get()._completeSignIn(user.uid, user.email, masterKey)
  },

  // Explicit, informed override after an ownerMismatch: adopt this device for
  // the current account — switch from pull-only to a full two-way reconcile
  // (this browser's local data gets pushed up) and claim the local-owner
  // marker so the mismatch doesn't recur.
  forceSyncThisDevice: async () => {
    const { user, pendingMasterKey } = get()
    if (!user || !pendingMasterKey) return
    set({ syncing: true })
    try {
      await syncEngine.start(user.uid, pendingMasterKey, { force: true })
      set({ ownerMismatch: false, pendingMasterKey: null })
    } finally {
      set({ syncing: false })
    }
  },

  // Manual "resync" — a live listener update can miss (tab was asleep, brief
  // disconnect, etc.), leaving two devices drifted with nothing telling the
  // user sync is stale. Re-runs the same full push/pull pass start() does,
  // reusing `syncing` so the button shows the same spinner as the initial one.
  resync: async () => {
    if (get().syncing) return
    set({ syncing: true })
    try {
      await syncEngine.resync()
    } finally {
      set({ syncing: false })
    }
  },

  signOut: async () => {
    syncEngine.stop()
    await fbAuth.signOutUser()
    await clearMasterKeys()
    set({ user: null, masterKey: null, needsUnlock: false, ownerMismatch: false, pendingMasterKey: null })
    // The onAuthStateChanged listener above sees user go null too, but by now
    // get().user is already cleared so its wasSignedIn guard is false — do the
    // purge here where we know a sign-out actually happened.
    await get()._purgeSyncedOnSignOut()
  },

  resetPassword: (email) => fbAuth.resetPassword(email),
}))
