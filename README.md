# DayIntent

A local-first day planner: a time-blocked day view, a backlog for unscheduled items, recurring items/habits, a daily journal, and stats — all stored in IndexedDB so it works fully offline. Signing in adds optional, end-to-end encrypted sync across devices via Firebase.

## Features

- **Day view** — hour-by-hour grid with drag-and-drop scheduling, all-day items, and overnight items that continue into the next day.
- **Backlog** — unscheduled items you can drag onto a date, with manual ordering and filters.
- **Recurring items & habits** — daily/weekly/every-N/monthly recurrence rules; habits are tracked separately on the Stats page.
- **Journal** — per-day notes (rich text), mood, spouse mood, and screen time.
- **Stats** — category time breakdowns and habit/screen-time trends over a date range.
- **Categories** — color-coded, used to tag and filter items.
- **Search** — quick lookup across items and instances.
- **Offline-first PWA** — installable, works offline; the app shell is precached with Workbox.
- **Optional encrypted cloud sync** — sign in to sync across devices. See [Sync & encryption](#sync--encryption) below.

## Tech stack

- React 18 + React Router
- Zustand for state
- IndexedDB (via `idb`) as the local source of truth
- Firebase Realtime Database + Auth (optional, only used when configured)
- Vite + `vite-plugin-pwa`
- Vitest + Testing Library for tests
- `@dnd-kit` for drag-and-drop

## Getting started

```bash
npm install
npm run dev
```

The app runs fully offline/local with no Firebase project configured — no cloud sync UI is shown at all in that case (see `src/firebase/config.js`).

To enable cloud sync, copy `.env.example` to `.env.local` and fill in your Firebase Web App config (Project settings → General → Your apps → SDK setup and configuration):

```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_DATABASE_URL=
VITE_FIREBASE_PROJECT_ID=
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
```

## Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Production build |
| `npm run preview` | Preview the production build locally |
| `npm test` | Run the Vitest suite |
| `npm run deploy` | Build and deploy to Firebase Hosting |

## Sync & encryption

Sync is opt-in per item (`item.syncEnabled`). Categories and journal entries always sync when signed in, since they're global/day-keyed rather than individually ownable.

Encryption is envelope-based and happens entirely client-side (`src/firebase/crypto.js`):

- A **master key** is derived from your password via PBKDF2 (600,000 iterations) with a per-user salt. It never leaves the device and is held only in memory — refreshing the page requires re-entering your password (`needsUnlock`).
- Each record gets its own random **data key** (AES-256-GCM), which is wrapped with the master key before being stored.
- Firebase only ever sees ciphertext and wrapped keys — it cannot decrypt your data.

Push (local → cloud) is last-write-wins from the writer's side; pull (cloud → local) compares `updatedAt` timestamps. Signing out purges synced items from the device (local-only items are kept); see `src/store/useAuthStore.js` for the sign-out/purge and owner-mismatch (pull-only mode) logic.

## Project structure

```
src/
  components/    UI, organized by feature (dayview, backlog, journal, stats, categories, auth, ...)
  data/          Local persistence: IndexedDB repository, recurrence/rollover logic, types
  sync/          Firebase sync engine (push/pull, tombstones, reconcile)
  firebase/      Firebase config, auth, and client-side crypto
  store/         Zustand stores (entities, app UI state, auth)
  hooks/         Data-fetching/derived-state hooks used by components
  utils/         Pure helpers (dates, drag-and-drop, colors, stats aggregation, rich text)
```

`src/data/index.js` is the storage abstraction — UI and store code should import only from there (it re-exports `syncedRepository.js`, which wraps the IndexedDB implementation with sync side effects).

## Deployment

Hosted on Firebase Hosting (`firebase.json`). `npm run deploy` builds and deploys in one step.
