import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests } from '../../data/db.js'
import * as repo from '../../data/index.js'
import { useEntityStore } from '../useEntityStore.js'

beforeEach(() => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
  useEntityStore.setState({ journalsByDate: {}, allJournals: [] })
})

const store = () => useEntityStore.getState()

describe('adjustMoodTally', () => {
  it('counts every tap even when they arrive back to back', async () => {
    await Promise.all([
      ...Array.from({ length: 10 }, () => store().adjustMoodTally('2026-01-05', 'me', 'pos', 1)),
      ...Array.from({ length: 4 }, () => store().adjustMoodTally('2026-01-05', 'me', 'neg', 1)),
      store().adjustMoodTally('2026-01-05', 'others', 'neg', 1),
    ])
    const saved = await repo.getJournalForDate('2026-01-05')
    expect(saved.moodTally).toEqual({ me: { pos: 10, neg: 4 }, others: { pos: 0, neg: 1 } })
    expect(store().journalsByDate['2026-01-05'].moodTally.me.pos).toBe(10)
  })

  it('undoes a tap but not below zero', async () => {
    await store().adjustMoodTally('2026-01-05', 'me', 'pos', 1)
    await store().adjustMoodTally('2026-01-05', 'me', 'pos', -1)
    await store().adjustMoodTally('2026-01-05', 'me', 'pos', -1)
    expect((await repo.getJournalForDate('2026-01-05')).moodTally.me.pos).toBe(0)
  })
})
