import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'

// Pick an existing group or name a new one for the selected tasks.
export function GroupPicker({ groups, count, onPick, onClose }) {
  const [name, setName] = useState('')
  const trimmed = name.trim()

  return (
    <Modal title={`Group ${count} task${count === 1 ? '' : 's'}`} onClose={onClose} width={360}>
      <div className="group-picker">
        <form
          className="group-picker-new"
          onSubmit={(e) => {
            e.preventDefault()
            if (trimmed) onPick(trimmed)
          }}
        >
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="New group name…"
            aria-label="New group name"
            autoFocus
          />
          <button type="submit" className="btn btn-primary" disabled={!trimmed}>
            Create
          </button>
        </form>
        {groups.length > 0 && (
          <>
            <div className="group-picker-label">Or add to an existing group</div>
            <div className="group-picker-list">
              {groups.map((g) => (
                <button key={g} type="button" className="group-picker-option" onClick={() => onPick(g)}>
                  {g}
                </button>
              ))}
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}
