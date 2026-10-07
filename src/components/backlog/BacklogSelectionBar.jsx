import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'
import { GroupPicker } from './GroupPicker.jsx'

// Shown while selecting tasks on the To do tab: group them, take them out of
// their group, or cancel. Replaces the floating + button while active.
export function BacklogSelectionBar({ ids, onDone }) {
  const items = useEntityStore((s) => s.items)
  const setItemsGroup = useEntityStore((s) => s.setItemsGroup)
  const [picking, setPicking] = useState(false)

  const groups = Array.from(new Set(items.map((i) => i.group).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
  const anyGrouped = items.some((i) => ids.includes(i.id) && i.group)

  const apply = async (groupName) => {
    setPicking(false)
    await setItemsGroup(ids, groupName)
    onDone()
  }

  return (
    <>
      <div className="backlog-selection-bar">
        <span className="backlog-selection-count">{ids.length} selected</span>
        <button
          type="button"
          className="btn btn-primary"
          disabled={ids.length === 0}
          onClick={() => setPicking(true)}
        >
          Group…
        </button>
        <button
          type="button"
          className="btn btn-subtle"
          disabled={!anyGrouped}
          onClick={() => apply(null)}
        >
          Remove from group
        </button>
        <button type="button" className="btn btn-subtle" onClick={onDone}>
          Cancel
        </button>
      </div>
      {picking && (
        <GroupPicker groups={groups} count={ids.length} onPick={apply} onClose={() => setPicking(false)} />
      )}
    </>
  )
}
