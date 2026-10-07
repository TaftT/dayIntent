import { useState } from 'react'
import { ColorSwatchPicker } from './ColorSwatchPicker.jsx'
import { OrderControls } from './OrderControls.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'

export function CategoryListItem({ category, index, count, onMove }) {
  const saveCategory = useEntityStore((s) => s.saveCategory)
  const deleteCategory = useEntityStore((s) => s.deleteCategory)
  const [name, setName] = useState(category.name)

  return (
    <div className="category-list-item">
      <OrderControls index={index} count={count} onMove={onMove} />
      <input
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onBlur={() => name.trim() && name !== category.name && saveCategory({ id: category.id, name })}
      />
      <ColorSwatchPicker color={category.color} onChange={(color) => saveCategory({ id: category.id, color })} />
      <button
        type="button"
        className="icon-button"
        onClick={() => deleteCategory(category.id)}
        aria-label={`Delete ${category.name}`}
      >
        🗑
      </button>
    </div>
  )
}
