# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

DayIntent — a local-first day planner (React + IndexedDB) with optional end-to-end encrypted cloud sync via Firebase. See [README.md](README.md) for the feature overview and setup.

## Commands

- `npm run dev` — start dev server
- `npm test` — run Vitest suite (`vitest run`)
- `npm run build` — production build
- `npm run deploy` — build + `firebase deploy`

There is no lint script configured; don't invent one.

## Architecture

**Storage layers — always import from `src/data/index.js`, never `indexedDbRepository.js` directly from UI/store code.**

```
src/data/index.js            re-exports syncedRepository.js (the public API)
  -> syncedRepository.js     wraps indexedDbRepository with Firebase push side effects
  -> indexedDbRepository.js  the actual IndexedDB CRUD, source of truth
```

- Local writes are always synchronous-first and never block on the network. `syncedRepository.js` saves locally, then fires an async, non-blocking push to `src/sync/syncEngine.js` (`.catch(() => {})` on purpose — sync failures must never surface as local write failures).
- `src/sync/syncEngine.js` owns the two-way Firebase sync: push (local wins, last-write on the writer's side), pull (last-write-wins by comparing plaintext `updatedAt`), and tombstones (`deletedItems`/`deletedInstances`) to distinguish a real delete from a per-item sync-toggle-off. Pull writes go straight through the raw `indexedDbRepository`, never through `syncedRepository`, so an incoming remote change doesn't re-trigger a push back up.
- `src/firebase/crypto.js` implements envelope encryption entirely client-side: a PBKDF2-derived master key (never persisted, held only in memory) wraps a random per-record AES-256-GCM data key. Firebase only ever stores ciphertext + wrapped keys.
- Sync is per-item opt-in (`item.syncEnabled`). Categories and journal entries always sync when signed in (no per-record toggle — they're global/day-keyed, not individually ownable).
- Sign-out purges synced items from the device but keeps local-only (`syncEnabled: false`) items; see `src/store/useAuthStore.js`. If a device's local data was last synced under a different account, sync runs in `pullOnly` mode until the user explicitly adopts the device (`OwnerMismatchError` / `forceSyncThisDevice`).

**Domain model** (`src/data/types.js`): `Item` (the reusable/recurring definition) vs `ScheduledInstance` (one occurrence on one date — its own `percentComplete`, `status`, `notes`, independent of the parent item). This split matters: recurring items need every occurrence tracked independently, not one shared value on the item.

- `src/data/recurrence.js` — expands a `RecurrenceRule` into concrete occurrence dates/instances, generated up to a rolling horizon (`GENERATION_HORIZON_DAYS`).
- `src/data/rollover.js` — idempotent end-of-day pass that finalizes past instances (`completed` / `worked_on` / `ghost`) and returns unfinished non-recurring items to the backlog. Safe to call repeatedly; only ever advances forward.

**State**: Zustand stores in `src/store/` — `useEntityStore` (items/instances/categories/journal, the in-memory mirror of IndexedDB), `useAppStore` (UI state), `useAuthStore` (Firebase auth + master key + sync lifecycle).

**UI**: `src/components/` organized by feature area (`dayview`, `backlog`, `itemdetail`, `journal`, `stats`, `categories`, `auth`, `search`, `notifications`, `layout`, `shared`). Data-fetching/derived-state hooks live in `src/hooks/`; pure helpers in `src/utils/`.

## Conventions

- Firebase is entirely optional. Code that touches it must degrade gracefully when `firebaseEnabled` is false (see `src/firebase/config.js`) — the app must keep working fully offline with no cloud UI shown.
- When changing sync or crypto logic, read the comment blocks at the top of `src/sync/syncEngine.js` and `src/firebase/crypto.js` first — they explain non-obvious invariants (tombstones vs. toggle-off, envelope encryption rationale) that are easy to accidentally break.
- Tests live under `__tests__` dirs next to the code they cover and run against `fake-indexeddb` (see `src/test/setup.js`) — no real browser or network needed.

## Known gotchas (from prior sessions)

- Sign-out purges synced items only and keeps local-only items; locked sync (before password unlock) hides synced items rather than deleting them; sync-pull must preserve `updatedAt` rather than overwriting it. Get this wrong and you risk data loss on sign-out/re-sign-in — check `src/store/__tests__/purgeSyncedOnSignOut.test.js` before changing `useAuthStore.js`'s sign-out path.
