import { useEffect } from 'react'
import { useEntityStore } from '../store/useEntityStore.js'
import { todayStr } from '../utils/dateUtils.js'
import { isRichTextEmpty } from '../utils/richText.js'

// Plain one-off tasks sit at the top; recurring series, all-day items, and
// finished tasks each drop into their own section below. Manual drag order
// still applies within a section.
export const BACKLOG_SECTIONS = ['tasks', 'recurring', 'allday', 'completed']
export const BACKLOG_SECTION_LABEL = {
  tasks: 'Tasks',
  recurring: 'Recurring',
  allday: 'All-day',
  completed: 'Completed',
}
const SECTION_RANK = { tasks: 0, recurring: 1, allday: 2, completed: 3 }

function sectionForRow(row) {
  if (row.type === 'instance' || row.item.recurrence) return 'recurring'
  if ((row.item.percentComplete ?? 0) >= 100) return 'completed'
  if (row.item.isAllDay) return 'allday'
  return 'tasks'
}

/**
 * @param {{status?: 'unscheduled'|'scheduled'|'past'|'all', categoryId?: string|null, isRecurring?: boolean, hasNotes?: boolean, searchText?: string}} filters
 * @returns {Array<{type: 'item', item: object, section: string} | {type: 'instance', item: object, instance: object, section: string}>}
 */
export function useBacklogItems(filters = {}) {
  const refreshAllInstances = useEntityStore((s) => s.refreshAllInstances)
  useEffect(() => {
    refreshAllInstances()
  }, [refreshAllInstances])

  const status = filters.status ?? 'unscheduled'

  return useEntityStore((s) => {
    // A non-finalized instance is always today-or-future (rollover only
    // finalizes once a day is in the past), so this set is exactly "items
    // with something upcoming on the calendar."
    const upcomingItemIds = new Set(
      s.allInstances.filter((i) => !i.finalized).map((i) => i.itemId)
    )

    const matchingItems = s.items.filter((item) => {
      const isUpcoming = upcomingItemIds.has(item.id)
      if (status === 'unscheduled' && !item.isUnscheduled) return false
      if (status === 'scheduled' && (item.isUnscheduled || !isUpcoming)) return false
      if (status === 'past' && (item.isUnscheduled || isUpcoming)) return false
      if (filters.categoryId && item.categoryId !== filters.categoryId) return false
      if (filters.isRecurring !== undefined && Boolean(item.recurrence) !== filters.isRecurring) {
        return false
      }
      if (filters.hasNotes && isRichTextEmpty(item.notes)) return false
      if (filters.searchText && filters.searchText.trim()) {
        const q = filters.searchText.trim().toLowerCase()
        const matches =
          item.title.toLowerCase().includes(q) || item.notes.toLowerCase().includes(q)
        if (!matches) return false
      }
      return true
    })

    const today = todayStr()
    const resolveNextInstance = status === 'scheduled' || status === 'all'

    const rows = matchingItems.map((item) => {
      // A recurring item is a series, not a single task — under the
      // scheduled/all views show just its next upcoming occurrence
      // (completable on its own), not the whole series.
      if (resolveNextInstance && item.recurrence) {
        const nextInstance = s.allInstances
          .filter((i) => i.itemId === item.id && !i.finalized && i.date >= today)
          .sort((a, b) => a.date.localeCompare(b.date) || (a.time ?? '').localeCompare(b.time ?? ''))[0]
        if (nextInstance) return { type: 'instance', item, instance: nextInstance }
      }
      return { type: 'item', item }
    })

    for (const row of rows) row.section = sectionForRow(row)

    rows.sort((a, b) => {
      const bySection = SECTION_RANK[a.section] - SECTION_RANK[b.section]
      return bySection !== 0 ? bySection : (a.item.order ?? 0) - (b.item.order ?? 0)
    })

    return rows
  })
}
