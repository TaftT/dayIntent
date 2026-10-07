import { useState } from 'react'
import { DndContext, closestCenter } from '@dnd-kit/core'
import { SortableContext, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { ToggleButton } from '../shared/ToggleButton.jsx'
import { useAuthStore } from '../../store/useAuthStore.js'
import { CategoryListItem } from './CategoryListItem.jsx'
import { GroupListItem } from './GroupListItem.jsx'
import { usePlannerSensors } from '../../utils/dnd/dndContextConfig.js'
import { useCategories } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { DEFAULT_COLOR_SWATCHES } from '../../utils/colorUtils.js'

// One place to manage both lists. The order set here is the order they appear
// in every picker (category dropdown, group chips) and in the grouped backlog.
export function CategoryManagerModal({ initialTab = 'categories' }) {
  const categories = useCategories()
  const groups = useEntityStore((s) => s.groups)
  const saveCategory = useEntityStore((s) => s.saveCategory)
  const createGroup = useEntityStore((s) => s.createGroup)
  const reorderCategories = useEntityStore((s) => s.reorderCategories)
  const reorderGroups = useEntityStore((s) => s.reorderGroups)
  const closeModal = useAppStore((s) => s.closeModal)
  const [tab, setTab] = useState(initialTab)
  const [newName, setNewName] = useState('')
  const signedIn = useAuthStore((s) => Boolean(s.user))
  // New categories sync by default when signed in; switch off to keep one on this device only.
  const [newSynced, setNewSynced] = useState(true)
  const sensors = usePlannerSensors()

  const isGroups = tab === 'groups'
  const list = isGroups ? groups : categories

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (isGroups) {
      await createGroup(name)
    } else {
      const color = DEFAULT_COLOR_SWATCHES[categories.length % DEFAULT_COLOR_SWATCHES.length]
      await saveCategory({ name, color, syncEnabled: signedIn && newSynced })
    }
    setNewName('')
  }

  const handleDragEnd = ({ active, over }) => {
    if (!over || active.id === over.id) return
    const ids = list.map((x) => x.id)
    const next = arrayMove(ids, ids.indexOf(active.id), ids.indexOf(over.id))
    return isGroups ? reorderGroups(next) : reorderCategories(next)
  }

  return (
    <Modal title="Organize" onClose={closeModal}>
      <div className="category-manager">
        <div className="manager-tabs" role="tablist">
          {[
            ['categories', 'Categories'],
            ['groups', 'Groups'],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              role="tab"
              aria-selected={tab === id}
              className={`manager-tab ${tab === id ? 'active' : ''}`}
              onClick={() => {
                setTab(id)
                setNewName('')
              }}
            >
              {label}
            </button>
          ))}
        </div>
        <p className="manager-hint">
          Drag the handles to set the order — it&apos;s the order they appear in everywhere you pick one.
        </p>
        <div className="category-add-row">
          <input
            type="text"
            placeholder={isGroups ? 'New group name' : 'New category name'}
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
          />
          <Button variant="primary" onClick={handleAdd}>
            Add
          </Button>
        </div>
        {signedIn && !isGroups && (
          <div className="category-sync-choice">
            <ToggleButton pressed={newSynced} onChange={setNewSynced}>
              {newSynced ? '☁ Sync to cloud' : 'This device only'}
            </ToggleButton>
            <span className="manager-hint">
              {newSynced
                ? 'Shows up on all your signed-in devices.'
                : 'Stays on this device; tasks that sync can’t use it.'}
            </span>
          </div>
        )}
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={list.map((x) => x.id)} strategy={verticalListSortingStrategy}>
            {list.map((entry) =>
              isGroups ? (
                <GroupListItem key={entry.id} group={entry} />
              ) : (
                <CategoryListItem key={entry.id} category={entry} />
              )
            )}
          </SortableContext>
        </DndContext>
        {list.length === 0 && <div className="empty-state">Nothing here yet.</div>}
      </div>
    </Modal>
  )
}
