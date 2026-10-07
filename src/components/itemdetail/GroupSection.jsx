import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'

// Lives where the parent/subtask linker used to: choose which group this task
// belongs to — tap an existing group or type a new name. The choice is saved
// with the rest of the form.
export function GroupSection({ group, onChange }) {
  const items = useEntityStore((s) => s.items)
  const [draft, setDraft] = useState('')
  const names = Array.from(new Set(items.map((i) => i.group).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
  const others = names.filter((n) => n !== group)

  const addNew = (e) => {
    e.preventDefault()
    const name = draft.trim()
    if (!name) return
    onChange(name)
    setDraft('')
  }

  return (
    <div className="group-section">
      <div className="group-section-title">Group</div>
      {group ? (
        <div className="group-section-current">
          <span className="backlog-group-chip">{group}</span>
          <button type="button" className="backlog-group-action" onClick={() => onChange('')}>
            Remove from group
          </button>
        </div>
      ) : (
        <div className="group-picker-label">Not in a group.</div>
      )}
      {others.length > 0 && (
        <div className="group-section-chips">
          {others.map((n) => (
            <button key={n} type="button" className="group-chip-btn" onClick={() => onChange(n)}>
              {n}
            </button>
          ))}
        </div>
      )}
      <form className="group-picker-new" onSubmit={addNew}>
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="New group…"
          aria-label="New group name"
        />
        <button type="submit" className="btn btn-subtle" disabled={!draft.trim()}>
          Add
        </button>
      </form>
    </div>
  )
}
