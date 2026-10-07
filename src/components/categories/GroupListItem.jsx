import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColorSwatchPicker } from './ColorSwatchPicker.jsx'
import { DragHandle } from './OrderControls.jsx'
import { ConfirmModal } from '../shared/ConfirmModal.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'

export function GroupListItem({ group }) {
  const saveGroup = useEntityStore((s) => s.saveGroup)
  const deleteGroup = useEntityStore((s) => s.deleteGroup)
  const memberCount = useEntityStore((s) => s.items.filter((i) => i.groupId === group.id).length)
  const [name, setName] = useState(group.name)
  const [confirming, setConfirming] = useState(false)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: group.id })

  return (
    <div
      ref={setNodeRef}
      className={`category-list-item ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <DragHandle setActivatorNodeRef={setActivatorNodeRef} listeners={listeners} attributes={attributes} />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== group.name && saveGroup({ id: group.id, name: name.trim() })}
      />
      <span className="group-member-count" title="Tasks in this group">
        {memberCount}
      </span>
      <button
        type="button"
        className="icon-button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${group.name}`}
      >
        🗑
      </button>
      <ColorSwatchPicker color={group.color} onChange={(color) => saveGroup({ id: group.id, color })} />
      {confirming && (
        <ConfirmModal
          title="Delete group?"
          message={`“${group.name}” will be deleted. Its ${memberCount} task${memberCount === 1 ? '' : 's'} will be kept and become ungrouped.`}
          confirmLabel="Delete group"
          danger
          onConfirm={() => {
            setConfirming(false)
            deleteGroup(group.id)
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
