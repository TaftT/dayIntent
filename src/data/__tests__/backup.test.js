import { describe, it, expect, beforeEach } from 'vitest'
import { IDBFactory } from 'fake-indexeddb'
import { _resetDbForTests, getDb } from '../db.js'
import * as repo from '../index.js'
import { exportBackup, parseBackup, importBackup, summarize, BackupError } from '../backup.js'

const fresh = () => {
  globalThis.indexedDB = new IDBFactory()
  _resetDbForTests()
}
beforeEach(fresh)

async function seed() {
  const cat = await repo.saveCategory({ name: 'Health', color: '#00aa00' })
  const item = await repo.saveItem({ title: 'Run', categoryId: cat.id })
  const inst = await repo.saveInstance({ itemId: item.id, date: '2026-11-01', time: '07:00', durationMinutes: 30, percentComplete: 100 })
  await repo.saveJournal({ date: '2026-11-01', content: '<p>good day</p>' })
  // An archived item (kept because it has finalized history) must be exported too.
  const old = await repo.saveItem({ title: 'Old task' })
  await repo.saveInstance({ itemId: old.id, date: '2026-10-01', finalized: true, status: 'completed', percentComplete: 100 })
  await repo.deleteItem(old.id)
  return { cat, item, inst, old }
}

describe('backup export/import', () => {
  it('round-trips everything, including archived items, into an empty device', async () => {
    const { item, inst, old } = await seed()
    const text = JSON.stringify(await exportBackup())

    fresh()
    const result = await importBackup(parseBackup(text), { mode: 'merge' })
    expect(result.unchanged).toBe(0)

    const db = await getDb()
    expect((await db.get('items', item.id)).title).toBe('Run')
    expect((await db.get('items', old.id)).archived).toBe(true)
    expect((await repo.getInstance(inst.id)).percentComplete).toBe(100)
    expect((await repo.getJournalForDate('2026-11-01')).content).toContain('good day')
    expect(summarize(parseBackup(text)).items).toBe(2)
  })

  it('merge keeps a newer local record; restore makes the file win', async () => {
    const { inst } = await seed()
    const doc = parseBackup(JSON.stringify(await exportBackup())) // file: 100%

    await repo.saveInstance({ id: inst.id, itemId: inst.itemId, date: inst.date, percentComplete: 20 }) // local is newer, 20%

    const merged = await importBackup(doc, { mode: 'merge' })
    expect((await repo.getInstance(inst.id)).percentComplete).toBe(20)
    expect(merged.updated).toBe(0)

    await importBackup(doc, { mode: 'restore' })
    expect((await repo.getInstance(inst.id)).percentComplete).toBe(100)
  })

  it('merge updates a record when the file copy is newer, and never deletes anything', async () => {
    const item = await repo.saveItem({ title: 'Task' })
    const doc = parseBackup(JSON.stringify(await exportBackup()))
    doc.data.items[0].title = 'Task (from file)'
    doc.data.items[0].updatedAt = '2999-01-01T00:00:00.000Z'
    const extra = await repo.saveItem({ title: 'Only on this device' })

    await importBackup(doc, { mode: 'merge' })
    expect((await repo.getItem(item.id)).title).toBe('Task (from file)')
    expect((await repo.getItem(extra.id)).title).toBe('Only on this device')
  })

  it('rejects files that are not DayIntent backups', () => {
    expect(() => parseBackup('not json')).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ hello: 'world' }))).toThrow(BackupError)
    expect(() => parseBackup(JSON.stringify({ app: 'dayintent', version: 99, data: {} }))).toThrow(/newer version/)
    expect(() => parseBackup(JSON.stringify({ app: 'dayintent', version: 1, data: { items: 'x' } }))).toThrow(BackupError)
  })

  it('skips records with no key instead of failing the whole import', async () => {
    const doc = parseBackup(JSON.stringify({ app: 'dayintent', version: 1, data: { items: [{ title: 'no id' }, { id: 'a', title: 'ok' }] } }))
    expect(doc.data.items).toHaveLength(1)
    await importBackup(doc)
    expect((await repo.getItem('a')).title).toBe('ok')
  })
})
