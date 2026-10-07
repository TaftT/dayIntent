import { useEffect, useRef, useState } from 'react'
import { useCategories } from '../../hooks/useCategories.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { isCategorySynced } from '../../utils/categorySync.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'

// A custom dropdown rather than a native <select>: native option lists can't
// render a per-option color swatch.
// syncedOnly: the task being edited syncs to the cloud, so only synced
// categories are offered — a device-local one wouldn't exist on your other
// devices. (A local category already chosen stays listed so it isn't dropped
// silently; a note explains it.)
export function CategoryPicker({ categoryId, onChange, syncedOnly = false }) {
  const allCategories = useCategories()
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const categories = syncedOnly
    ? allCategories.filter((c) => isCategorySynced(c) || c.id === categoryId)
    : allCategories
  const [open, setOpen] = useState(false)
  const rootRef = useRef(null)
  const selected = categories.find((c) => c.id === categoryId)
  const selectedIsLocal = Boolean(selected) && !isCategorySynced(selected)

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
                {signedIn && c.id && !isCategorySynced(c) && <span className="category-local-tag">this device</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {syncedOnly && signedIn && selectedIsLocal && (
        <div className="category-local-note">
          This category only exists on this device, so it won&apos;t show on your other devices.
        </div>
      )}
    </div>
  )
}
