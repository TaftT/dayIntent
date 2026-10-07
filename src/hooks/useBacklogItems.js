import { useEffect, useMemo } from 'react'
import { useEntityStore } from '../store/useEntityStore.js'
import { useAuthStore } from '../store/useAuthStore.js'
import { todayStr, addDaysStr, toDateStr } from '../utils/dateUtils.js'

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

// Category filter value meaning "only tasks with no category".
export const UNCATEGORIZED_FILTER = '__none__'

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
    // The day it was finished — only known when it was completed on a
    // calendar occurrence. A task ticked off straight from the backlog has no
    // trustworthy date (it may have been done long ago and just cleared), so
    // it gets none; sortDate (last update) is used purely for ordering.
    const completedInstance = insts
      .filter((i) => (i.percentComplete ?? 0) >= 100)
      .sort((a, b) => b.date.localeCompare(a.date))[0]
    const completedDate = completedInstance?.date ?? null
    const sortDate = completedDate ?? (item.updatedAt ? toDateStr(new Date(item.updatedAt)) : null)
    return { item, nextInstance, percent, tabs, completedDate, sortDate }
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
  const groups = useEntityStore((s) => s.groups)
  const allInstances = useEntityStore((s) => s.allInstances)
  // While cloud sync is locked (signed in, password not re-entered) a synced
  // item's up-to-date content can't be trusted, so it's hidden entirely —
  // only local-only items show until sync is unlocked.
  const hideSynced = useAuthStore((s) => Boolean(s.user) && s.needsUnlock)
  const { categoryId = null, searchText = '' } = filters

  return useMemo(() => {
    const today = todayStr()
    const groupNameById = new Map(groups.map((g) => [g.id, g.name]))
    const visible = hideSynced ? items.filter((i) => !i.syncEnabled) : items
    const classified = classify(visible, allInstances, today)

    // Counts ignore search/category so the tabs stay stable while filtering.
    const counts = Object.fromEntries(BACKLOG_TABS.map((t) => [t.id, 0]))
    for (const c of classified) for (const t of c.tabs) counts[t] += 1

    const q = searchText.trim().toLowerCase()
    const matching = classified.filter((c) => {
      if (!c.tabs.has(tab)) return false
      if (categoryId === UNCATEGORIZED_FILTER) {
        if (c.item.categoryId) return false
      } else if (categoryId && c.item.categoryId !== categoryId) {
        return false
      }
      if (
        q &&
        !(
          c.item.title.toLowerCase().includes(q) ||
          (c.item.notes ?? '').toLowerCase().includes(q) ||
          (groupNameById.get(c.item.groupId) ?? '').toLowerCase().includes(q)
        )
      ) {
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
      completedDate: c.completedDate,
      sortDate: c.sortDate,
      section: tab === 'scheduled' && c.nextInstance ? dateSection(c.nextInstance.date, today) : null,
    }))

    if (tab === 'scheduled' || tab === 'recurring') {
      rows.sort((a, b) =>
        a.nextInstance && b.nextInstance
          ? nextKey(a.nextInstance).localeCompare(nextKey(b.nextInstance))
          : byOrder(a, b)
      )
    } else if (tab === 'done') {
      rows.sort(
        (a, b) =>
          (b.sortDate ?? '').localeCompare(a.sortDate ?? '') ||
          (b.item.updatedAt ?? '').localeCompare(a.item.updatedAt ?? '')
      )
    } else {
      rows.sort(byOrder)
    }

    // Per-group progress for the grouped view's headers, over every task in
    // the group (whatever tab it's on), not just the visible ones.
    const groupStats = {}
    for (const c of classified) {
      const g = c.item.groupId
      if (!g || c.item.recurrence) continue
      groupStats[g] ??= { total: 0, done: 0 }
      groupStats[g].total += 1
      if (c.percent >= 100) groupStats[g].done += 1
    }

    return { rows, counts, groupStats }
  }, [items, groups, allInstances, hideSynced, tab, categoryId, searchText])
}
