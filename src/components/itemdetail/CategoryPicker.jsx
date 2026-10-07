import { useEffect, useRef, useState } from 'react'
import { useCategories } from '../../hooks/useCategories.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'

// A custom dropdown rather than a native <select>: native option lists can't
// render a per-option color swatch.
export function CategoryPicker({ categoryId, onChange }) {
  const categories = useCategories()
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = categories.find((c) => c.id === categoryId)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => {
      if (e.key === 'Escape') {
        // Close just the list, not the whole modal behind it.
        e.stopPropagation()
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', onDown)
    window.addEventListener('keydown', onKey, true)
    return () => {
      document.removeEventListener('mousedown', onDown)
      window.removeEventListener('keydown', onKey, true)
    }
  }, [open])

  const choose = (id) => {
    onChange(id)
    setOpen(false)
  }

  const options = [{ id: null, name: 'No category', color: UNCATEGORIZED_COLOR }, ...categories]

  return (
    <div className="category-picker-wrap" ref={rootRef}>
      <button
        type="button"
        className="category-picker"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="category-dot category-picker-dot" style={{ background: selected?.color ?? UNCATEGORIZED_COLOR }} />
        <span className="category-picker-label">{selected?.name ?? 'No category'}</span>
        <span className="category-picker-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="category-picker-list" role="listbox">
          {options.map((c) => (
            <li key={c.id ?? 'none'} role="option" aria-selected={c.id === (categoryId ?? null)}>
              <button type="button" onClick={() => choose(c.id)}>
                <span className="category-dot category-picker-dot" style={{ background: c.color ?? UNCATEGORIZED_COLOR }} />
                {c.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
