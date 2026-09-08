import * as repo from './index.js'

/**
 * Lazy, idempotent end-of-day rollover pass. Safe to call repeatedly (app
 * bootstrap, view mount, window focus, interval) — only ever advances
 * instances forward, never re-processes already-finalized days.
 *
 * Each instance tracks its own percentComplete — recurring items need every
 * occurrence's progress tracked independently, not one shared value on the
 * item. For every non-finalized instance with date <= today (oldest first):
 *  1. Activate: if startPercent is unset, snapshot the instance's own
 *     percentComplete as the value "carried into" that day.
 *  2. Finalize (only when date < today, never for today): compare the
 *     instance's current percentComplete to startPercent to classify the day
 *     as completed / worked_on / ghost, lock the instance, and — if not
 *     completed and the item isn't recurring — return the item to the
 *     backlog (isUnscheduled: true), syncing the item's percentComplete to
 *     the instance's so the backlog reflects the real last-known progress.
 * @param {string} today - 'YYYY-MM-DD'
 */
export async function runRollover(today) {
  const pending = await repo.getPendingInstancesThrough(today)

  for (const instance of pending) {
    const item = await repo.getItem(instance.itemId)
    if (!item) continue

    let next = instance

    if (next.startPercent === null) {
      next = await repo.saveInstance({ ...next, startPercent: next.percentComplete })
    }

    if (next.date < today) {
      const currentPercent = next.percentComplete
      let status
      if (currentPercent >= 100) status = 'completed'
      else if (currentPercent > next.startPercent) status = 'worked_on'
      else status = 'ghost'

      await repo.saveInstance({
        ...next,
        status,
        finalPercent: currentPercent,
        finalized: true,
      })

      if (status !== 'completed' && !item.recurrence && !item.isUnscheduled) {
        // Land it at the top of the backlog (negative order sorts ahead of
        // every positive one) so a task that fell off the calendar is the
        // first thing seen, not buried at the bottom.
        await repo.saveItem({
          ...item,
          isUnscheduled: true,
          percentComplete: currentPercent,
          order: -Date.now(),
        })
      }
    }
  }
}

/**
 * Live display status for an instance, without waiting for it to be
 * finalized. Finalized instances return their locked-in historical status.
 * @param {import('./types.js').ScheduledInstance} instance
 * @returns {'completed'|'worked_on'|'ghost'|'in_progress'|'pending'}
 */
export function getDisplayStatus(instance) {
  if (instance.finalized) return instance.status
  if (instance.percentComplete >= 100) return 'completed'
  if (instance.startPercent != null && instance.percentComplete > instance.startPercent) {
    return 'in_progress'
  }
  return 'pending'
}
