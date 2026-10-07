import { describe, it, expect, beforeEach } from 'vitest'
import { loadStatsRange, saveStatsRange } from '../statsRangeStorage.js'
import { currentWeekRange, todayStr, addDaysStr } from '../dateUtils.js'

beforeEach(() => localStorage.clear())

describe('statsRangeStorage', () => {
  it('defaults to this week when nothing is saved', () => {
    expect(loadStatsRange()).toEqual(currentWeekRange())
  })

  it('remembers a preset as a preset, not as frozen dates', () => {
    const to = todayStr()
    saveStatsRange({ from: addDaysStr(to, -29), to })
    // pretend it was saved a while ago with different dates in the payload
    expect(JSON.parse(localStorage.getItem('dayintent.statsRange'))).toEqual({ kind: 'days', days: 30 })
    expect(loadStatsRange()).toEqual({ from: addDaysStr(to, -29), to })
  })

  it('remembers a custom range exactly', () => {
    saveStatsRange({ from: '2026-01-02', to: '2026-01-09' })
    expect(loadStatsRange()).toEqual({ from: '2026-01-02', to: '2026-01-09' })
  })

  it('remembers today and this week', () => {
    saveStatsRange({ from: todayStr(), to: todayStr() })
    expect(loadStatsRange()).toEqual({ from: todayStr(), to: todayStr() })
    saveStatsRange(currentWeekRange())
    expect(loadStatsRange()).toEqual(currentWeekRange())
  })

  it('ignores unreadable saved data', () => {
    localStorage.setItem('dayintent.statsRange', '{not json')
    expect(loadStatsRange()).toEqual(currentWeekRange())
  })
})
