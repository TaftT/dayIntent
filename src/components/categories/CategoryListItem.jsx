import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { ColorSwatchPicker } from './ColorSwatchPicker.jsx'
import { DragHandle } from './OrderControls.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'

export function CategoryListItem({ category }) {
  const saveCategory = useEntityStore((s) => s.saveCategory)
  const deleteCategory = useEntityStore((s) => s.deleteCategory)
  const [name, setName] = useState(category.name)
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
    </div>
  )
}
