import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'

// Lives where the parent/subtask linker used to: choose which group this task
// belongs to — tap a group (in the order set in Organize), or "+" to create a
// new one. `groupId` is saved with the rest of the form.
export function GroupSection({ groupId, onChange }) {
  const groups = useEntityStore((s) => s.groups)
  const createGroup = useEntityStore((s) => s.createGroup)
  const [creating, setCreating] = useState(false)
  const [draft, setDraft] = useState('')
  const trimmed = draft.trim()

  const closeNew = () => {
    setCreating(false)
    setDraft('')
  }

  const create = async (e) => {
    e.preventDefault()
    if (!trimmed) return
    const group = await createGroup(trimmed)
    onChange(group.id)
    closeNew()
  }

  return (
    <div className="group-section">
      <div className="group-section-title">Group</div>
      <div className="group-section-chips">
        {groups.map((g) => (
          <button
            key={g.id}
            type="button"
            className={`group-chip-btn ${g.id === groupId ? 'selected' : ''}`}
            aria-pressed={g.id === groupId}
            onClick={() => onChange(g.id === groupId ? '' : g.id)}
          >
            <span className="category-dot" style={{ background: g.color }} />
            {g.name}
          </button>
        ))}
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
      {!groupId && (
        <div className="group-picker-label">Not in a group. Tap a group to add this task, tap it again to remove it.</div>
      )}

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
