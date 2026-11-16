import { describe, it, expect } from 'vitest'
import { computeLanes } from '../weekLayout.js'

describe('computeLanes', () => {
  it('gives a lone block the full width', () => {
    expect(computeLanes([{ id: 'a', start: 60, end: 120 }]).get('a')).toEqual({ lane: 0, lanes: 1 })
  })

  it('splits two overlapping blocks into two lanes', () => {
    const r = computeLanes([
      { id: 'a', start: 60, end: 120 },
      { id: 'b', start: 90, end: 150 },
    ])
    expect(r.get('a')).toEqual({ lane: 0, lanes: 2 })
    expect(r.get('b')).toEqual({ lane: 1, lanes: 2 })
  })

  it('reuses a lane once a block has ended, and keeps separate clusters independent', () => {
    const r = computeLanes([
      { id: 'a', start: 0, end: 60 },
      { id: 'b', start: 30, end: 90 },
      { id: 'c', start: 60, end: 120 },
      { id: 'd', start: 300, end: 360 },
    ])
    expect(r.get('c')).toEqual({ lane: 0, lanes: 2 })
    expect(r.get('d')).toEqual({ lane: 0, lanes: 1 })
  })
})
