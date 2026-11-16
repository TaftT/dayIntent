import { describe, it, expect } from 'vitest'
import { formatRangeHeading } from '../dateUtils.js'

describe('formatRangeHeading', () => {
  it('collapses the month when the 7 days stay in one month', () => {
    expect(formatRangeHeading('2026-08-17')).toBe('Aug 17 – 23, 2026')
  })
  it('names both months when it crosses a month', () => {
    expect(formatRangeHeading('2026-08-30')).toBe('Aug 30 – Sep 5, 2026')
  })
  it('names both years when it crosses New Year', () => {
    expect(formatRangeHeading('2026-12-30')).toBe('Dec 30, 2026 – Jan 5, 2027')
  })
})
