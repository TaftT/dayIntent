import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'

// Lives where the parent/subtask linker used to: choose which group this task
// belongs to — tap an existing group, or "+" to name a new one. The choice is
// saved with the rest of the form.
export function GroupSection({ group, onChange }) {
  const items = useEntityStore((s) => s.items)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const names = Array.from(new Set(items.map((i) => i.group).filter(Boolean))).sort((a, b) =>
    a.localeCompare(b)
  )
  const trimmed = draft.trim()

  const closeNew = () => {
    setCreating(false)
    setDraft('')
  }

  const create = (e) => {
    e.preventDefault()
    if (!trimmed) return
    onChange(trimmed)
    closeNew()
  }

  return (
    <div className="group-section">
      <div className="group-section-title">Group</div>
      <div className="group-section-chips">
        {names.map((n) => (
          <button
            key={n}
            type="button"
            className={`group-chip-btn ${n === group ? 'selected' : ''}`}
            aria-pressed={n === group}
            onClick={() => onChange(n === group ? '' : n)}
          >
            {n}
          </button>
        ))}
        {/* A group set here but not yet saved anywhere else won't be in `names`. */}
        {group && !names.includes(group) && (
          <button type="button" className="group-chip-btn selected" aria-pressed onClick={() => onChange('')}>
            {group}
          </button>
        )}
        <button
          type="button"
          className="group-chip-btn group-chip-add"
          aria-label="New group"
          title="New group"
          onClick={() => setCreating(true)}
        >
          +
        </button>
      </div>
      {!group && <div className="group-picker-label">Not in a group. Tap a group to add this task, tap it again to remove it.</div>}

      {creating && (
        <Modal title="New group" onClose={closeNew} width={340}>
          <form className="group-picker-new" onSubmit={create}>
            <input
              type="text"
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Group name"
              aria-label="Group name"
              autoFocus
            />
            <button type="submit" className="btn btn-primary" disabled={!trimmed}>
              Create
            </button>
          </form>
        </Modal>
      )}
    </div>
  )
}
