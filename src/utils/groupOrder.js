/**
 * Reorders only the members of a group inside the single global priority
 * list, leaving every other task exactly where it is. The group's tasks keep
 * occupying the same slots; only which task sits in which slot changes.
 *
 * e.g. global order [1, 3, 2] with 1 and 2 in group A: moving 2 above 1 gives
 * [2, 3, 1] — task 3 stays second.
 *
 * @param {string[]} orderedIds all item ids in current global priority order
 * @param {string[]} groupIds the group's (visible) item ids
 * @param {string} draggedId
 * @param {string} targetId
 * @param {'before'|'after'} position relative to targetId
 * @returns {string[]} the new global order (same array contents, different order)
 */
export function reorderWithinGroup(orderedIds, groupIds, draggedId, targetId, position) {
  const members = new Set(groupIds)
  if (!members.has(draggedId) || !members.has(targetId) || draggedId === targetId) return orderedIds

  const slots = []
  const sequence = []
  orderedIds.forEach((id, index) => {
    if (members.has(id)) {
      slots.push(index)
      sequence.push(id)
    }
  })

  const without = sequence.filter((id) => id !== draggedId)
  const targetIndex = without.indexOf(targetId)
  if (targetIndex === -1) return orderedIds
  without.splice(position === 'after' ? targetIndex + 1 : targetIndex, 0, draggedId)

  const result = orderedIds.slice()
  slots.forEach((slot, k) => {
    result[slot] = without[k]
  })
  return result
}
