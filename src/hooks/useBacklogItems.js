import { useEffect, useMemo } from 'react'
import { useEntityStore } from '../store/useEntityStore.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { todayStr, addDaysStr } from '../utils/dateUtils.js'

// The backlog is split into distinct views instead of one mixed list:
//   todo       unscheduled, not done — in priority order (top = most important)
//   scheduled  on the calendar, not done — by date, so the soonest is first
//   recurring  repeating series, by next occurrence
//   progress   started but not finished (0 < % < 100), wherever it lives
//   done       finished
export const BACKLOG_TABS = [
  { id: 'todo', label: 'To do' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'recurring', label: 'Recurring' },
  { id: 'progress', label: 'In progress' },
  { id: 'done', label: 'Done' },
]

const byOrder = (a, b) => (a.item.order ?? 0) - (b.item.order ?? 0)
const nextKey = (inst) => `${inst.date} ${inst.time ?? '00:00'}`

function dateSection(date, today) {
  if (date <= today) return 'Today'
  if (date === addDaysStr(today, 1)) return 'Tomorrow'
  if (date <= addDaysStr(today, 7)) return 'Next 7 days'
  return 'Later'
}

/**
 * Classifies every item once, so tab counts and the visible rows come from
 * the same pass.
 */
function classify(items, allInstances, today) {
  const byItem = new Map()
  for (const inst of allInstances) {
    if (!byItem.has(inst.itemId)) byItem.set(inst.itemId, [])
    byItem.get(inst.itemId).push(inst)
  }

  return items.map((item) => {
    const insts = byItem.get(item.id) ?? []
    const upcoming = insts.filter((i) => !i.finalized).sort((a, b) => nextKey(a).localeCompare(nextKey(b)))
    // The next occurrence that still needs doing — an already-completed one
    // (e.g. today's, for a daily series) is skipped so the list shows what's
    // actually left. Falls back to a completed one if nothing else is upcoming.
    const pending = upcoming.filter((i) => (i.percentComplete ?? 0) < 100)
    const nextInstance =
      pending.find((i) => i.date >= today) ?? pending[0] ?? upcoming.find((i) => i.date >= today) ?? upcoming[0] ?? null
    const lastFinalized = insts
      .filter((i) => i.finalized)
      .sort((a, b) => b.date.localeCompare(a.date))[0]

    // A scheduled item's progress lives on its occurrence; an unscheduled
    // one's lives on the item itself.
    const percent = item.isUnscheduled
      ? (item.percentComplete ?? 0)
      : (nextInstance?.percentComplete ?? lastFinalized?.percentComplete ?? item.percentComplete ?? 0)

    const tabs = new Set()
    if (item.recurrence) {
      tabs.add('recurring')
    } else if (percent >= 100) {
      tabs.add('done')
    } else {
      if (item.isUnscheduled || !nextInstance) tabs.add('todo')
      else tabs.add('scheduled')
      if (percent > 0) tabs.add('progress')
    }
    return { item, nextInstance, percent, tabs }
  })
}

/**
 * @param {{tab?: string, categoryId?: string|null, searchText?: string}} filters
 * @returns {{rows: object[], counts: Record<string, number>}}
 */
export function useBacklogItems(filters = {}) {
  const refreshAllInstances = useEntityStore((s) => s.refreshAllInstances)
  useEffect(() => {
    refreshAllInstances()
  }, [refreshAllInstances])

  const tab = filters.tab ?? 'todo'
  const items = useEntityStore((s) => s.items)
  const allInstances = useEntityStore((s) => s.allInstances)
  // While cloud sync is locked (signed in, password not re-entered) a synced
  // item's up-to-date content can't be trusted, so it's hidden entirely —
  // only local-only items show until sync is unlocked.
  const hideSynced = useAuthStore((s) => Boolean(s.user) && s.needsUnlock)
  const { categoryId = null, searchText = '' } = filters

  return useMemo(() => {
    const today = todayStr()
    const visible = hideSynced ? items.filter((i) => !i.syncEnabled) : items
    const classified = classify(visible, allInstances, today)

    // Counts ignore search/category so the tabs stay stable while filtering.
    const counts = Object.fromEntries(BACKLOG_TABS.map((t) => [t.id, 0]))
    for (const c of classified) for (const t of c.tabs) counts[t] += 1

    const q = searchText.trim().toLowerCase()
    const matching = classified.filter((c) => {
      if (!c.tabs.has(tab)) return false
      if (categoryId && c.item.categoryId !== categoryId) return false
      if (q && !(c.item.title.toLowerCase().includes(q) || (c.item.notes ?? '').toLowerCase().includes(q))) {
        return false
      }
      return true
    })

    const rows = matching.map((c) => ({
      // A recurring series is shown as its next occurrence, completable on its own.
      type: tab === 'recurring' && c.nextInstance ? 'instance' : 'item',
      item: c.item,
      instance: c.nextInstance,
      nextInstance: c.nextInstance,
      percent: c.percent,
      section: tab === 'scheduled' && c.nextInstance ? dateSection(c.nextInstance.date, today) : null,
    }))

    if (tab === 'scheduled' || tab === 'recurring') {
      rows.sort((a, b) =>
        a.nextInstance && b.nextInstance
          ? nextKey(a.nextInstance).localeCompare(nextKey(b.nextInstance))
          : byOrder(a, b)
      )
    } else if (tab === 'done') {
      rows.sort((a, b) => (b.item.updatedAt ?? '').localeCompare(a.item.updatedAt ?? ''))
    } else {
      rows.sort(byOrder)
    }

    return { rows, counts }
  }, [items, allInstances, hideSynced, tab, categoryId, searchText])
}
