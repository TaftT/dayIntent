import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'
import { GroupPicker } from './GroupPicker.jsx'

// Shown while selecting tasks on the To do tab: group them, take them out of
// their group, or cancel. Replaces the floating + button while active.
export function BacklogSelectionBar({ ids, onDone }) {
  const items = useEntityStore((s) => s.items)
  const groups = useEntityStore((s) => s.groups)
  const setItemsGroup = useEntityStore((s) => s.setItemsGroup)
  const createGroup = useEntityStore((s) => s.createGroup)
  const [picking, setPicking] = useState(false)

  const anyGrouped = items.some((i) => ids.includes(i.id) && i.groupId)

  // `choice` is { id } for an existing group, { name } for a new one, or null to ungroup.
  const apply = async (choice) => {
    setPicking(false)
    let groupId = null
    if (choice?.id) groupId = choice.id
    else if (choice?.name) groupId = (await createGroup(choice.name)).id
    await setItemsGroup(ids, groupId)
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
