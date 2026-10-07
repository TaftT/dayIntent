import { useState } from 'react'
import { ColorSwatchPicker } from './ColorSwatchPicker.jsx'
import { OrderControls } from './OrderControls.jsx'
import { ConfirmModal } from '../shared/ConfirmModal.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'

export function GroupListItem({ group, index, count, onMove }) {
  const saveGroup = useEntityStore((s) => s.saveGroup)
  const deleteGroup = useEntityStore((s) => s.deleteGroup)
  const memberCount = useEntityStore((s) => s.items.filter((i) => i.groupId === group.id).length)
  const [name, setName] = useState(group.name)
  const [confirming, setConfirming] = useState(false)

  return (
    <div className="category-list-item">
      <OrderControls index={index} count={count} onMove={onMove} />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== group.name && saveGroup({ id: group.id, name: name.trim() })}
      />
      <span className="group-member-count" title="Tasks in this group">
        {memberCount}
      </span>
      <ColorSwatchPicker color={group.color} onChange={(color) => saveGroup({ id: group.id, color })} />
      <button
        type="button"
        className="icon-button"
        onClick={() => setConfirming(true)}
        aria-label={`Delete ${group.name}`}
      >
        🗑
      </button>
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
