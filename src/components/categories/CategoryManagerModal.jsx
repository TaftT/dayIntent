import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { CategoryListItem } from './CategoryListItem.jsx'
import { GroupListItem } from './GroupListItem.jsx'
import { moveInList } from './OrderControls.jsx'
import { useCategories } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { CATEGORY_COLOR_SWATCHES } from '../../utils/colorUtils.js'

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

  const isGroups = tab === 'groups'
  const list = isGroups ? groups : categories

  const handleAdd = async () => {
    const name = newName.trim()
    if (!name) return
    if (isGroups) {
      await createGroup(name)
    } else {
      const color = CATEGORY_COLOR_SWATCHES[categories.length % CATEGORY_COLOR_SWATCHES.length]
      await saveCategory({ name, color })
    }
    setNewName('')
  }

  const move = (from, to) => {
    const ids = moveInList(
      list.map((x) => x.id),
      from,
      to
    )
    return isGroups ? reorderGroups(ids) : reorderCategories(ids)
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
          Use the arrows to set the order — it&apos;s the order they appear in everywhere you pick one.
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
        {list.map((entry, index) =>
          isGroups ? (
            <GroupListItem key={entry.id} group={entry} index={index} count={list.length} onMove={move} />
          ) : (
            <CategoryListItem key={entry.id} category={entry} index={index} count={list.length} onMove={move} />
          )
        )}
        {list.length === 0 && <div className="empty-state">Nothing here yet.</div>}
      </div>
    </Modal>
  )
}
