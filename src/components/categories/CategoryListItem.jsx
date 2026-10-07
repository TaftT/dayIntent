import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColorSwatchPicker } from './ColorSwatchPicker.jsx'
import { DragHandle } from './OrderControls.jsx'
import { ConfirmModal } from '../shared/ConfirmModal.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { isCategorySynced } from '../../utils/categorySync.js'

export function CategoryListItem({ category }) {
  const saveCategory = useEntityStore((s) => s.saveCategory)
  const deleteCategory = useEntityStore((s) => s.deleteCategory)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const [name, setName] = useState(category.name)
  const [confirmSync, setConfirmSync] = useState(false)
  const synced = isCategorySynced(category)
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: category.id })

  return (
    <div
      ref={setNodeRef}
      className={`category-list-item ${isDragging ? 'dragging' : ''}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
    >
      <div className="category-list-main">
        <DragHandle setActivatorNodeRef={setActivatorNodeRef} listeners={listeners} attributes={attributes} />
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && name !== category.name && saveCategory({ id: category.id, name })}
        />
        {signedIn &&
          (synced ? (
            <span className="category-sync-badge synced" title="Synced to your account">
              ☁
            </span>
          ) : (
            <button
              type="button"
              className="category-sync-badge"
              title="Only on this device — tap to sync it to your account"
              onClick={() => setConfirmSync(true)}
            >
              This device
            </button>
          ))}
        <button
          type="button"
          className="icon-button"
          onClick={() => deleteCategory(category.id)}
          aria-label={`Delete ${category.name}`}
        >
          🗑
        </button>
      </div>
      <ColorSwatchPicker color={category.color} onChange={(color) => saveCategory({ id: category.id, color })} />
      {confirmSync && (
        <ConfirmModal
          title="Sync this category?"
          message={`“${category.name}” will be added to your account and appear on your other devices. A synced category can't be switched back to this-device-only — you'd have to delete it.`}
          confirmLabel="Sync it"
          onConfirm={() => {
            setConfirmSync(false)
            saveCategory({ id: category.id, syncEnabled: true })
          }}
          onCancel={() => setConfirmSync(false)}
        />
      )}
    </div>
  )
}
