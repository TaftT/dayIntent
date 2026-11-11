import { describe, it, expect } from 'vitest'
import { buildJournalPrintHtml, hasPrintableContent } from '../journalPrint.js'

describe('journal print', () => {
  it('skips blank entries', () => {
    expect(hasPrintableContent({ date: '2026-10-01', content: '<p><br></p>', itemNotes: [] })).toBe(false)
    expect(hasPrintableContent({ date: '2026-10-01', content: '<p>hi</p>', itemNotes: [] })).toBe(true)
    expect(
      hasPrintableContent({ date: '2026-10-01', content: '', itemNotes: [{ title: 'T', notes: '<p>n</p>' }] })
    ).toBe(true)
  })

  it('builds a two-column letter page and escapes item titles', () => {
    const html = buildJournalPrintHtml(
      [{ date: '2026-10-01', content: '<p>hi</p>', itemNotes: [{ title: '<b>x</b>', notes: '<p>n</p>' }] }],
      { from: '2026-10-01', to: '2026-10-31' }
    )
    expect(html).toContain('size: letter')
    expect(html).toContain('column-count: 2')
    expect(html).toContain('&lt;b&gt;x&lt;/b&gt;')
  })
})
