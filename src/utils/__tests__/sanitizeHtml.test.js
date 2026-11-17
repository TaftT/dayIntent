import { describe, it, expect } from 'vitest'
import { sanitizeHtml } from '../sanitizeHtml.js'

describe('sanitizeHtml', () => {
  it('keeps ordinary editor formatting', () => {
    const html = '<p>Hi <b>there</b> <i>you</i> <u>all</u></p><ul><li>one</li></ul><h1>Title</h1><br>'
    expect(sanitizeHtml(html)).toBe(html)
  })
  it('removes scripts, handlers and javascript: links', () => {
    const out = sanitizeHtml(
      '<p onclick="steal()">x</p><script>steal()</script><img src=x onerror="steal()"><a href="javascript:steal()">l</a>',
    )
    expect(out).not.toMatch(/script|onclick|onerror|javascript:|<img/i)
    expect(out).toContain('x')
  })
  it('removes frames, forms and styles', () => {
    const out = sanitizeHtml('<iframe src="//evil"></iframe><form action="//evil"><input></form><style>*{}</style>ok')
    expect(out).toBe('ok')
  })
  it('opens links safely', () => {
    expect(sanitizeHtml('<a href="https://example.com">e</a>')).toBe(
      '<a href="https://example.com" target="_blank" rel="noopener noreferrer">e</a>',
    )
  })
  it('handles empty input', () => {
    expect(sanitizeHtml(null)).toBe('')
    expect(sanitizeHtml(undefined)).toBe('')
  })
})
