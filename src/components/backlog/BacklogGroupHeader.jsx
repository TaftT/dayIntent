import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { ConfirmModal } from '../shared/ConfirmModal.jsx'

// Header for one group in the grouped view. Tapping the name opens the group
// (every task in it, with add/remove); the arrow collapses it. `group` is null
// for the "No group" section.
export function BacklogGroupHeader({ group, stats, shown, collapsed, onToggle }) {
  const renameGroup = useEntityStore((s) => s.renameGroup)
  const setItemsGroup = useEntityStore((s) => s.setItemsGroup)
  const items = useEntityStore((s) => s.items)
  const openModal = useAppStore((s) => s.openModal)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group ?? '')
  const [confirming, setConfirming] = useState(false)

  if (group === null) {
    return (
      <div className="backlog-group-header backlog-group-header-none">
        <span className="backlog-group-name">No group</span>
        <span className="backlog-group-count">{shown}</span>
      </div>
    )
  }

  const memberIds = items.filter((i) => i.group === group).map((i) => i.id)
  const pct = stats && stats.total > 0 ? (stats.done / stats.total) * 100 : 0

  const commitRename = async () => {
    setEditing(false)
    await renameGroup(group, draft)
  }

  return (
    <div className="backlog-group-header">
      <button
        type="button"
        className="backlog-group-toggle"
        onClick={onToggle}
        aria-expanded={!collapsed}
        aria-label={collapsed ? `Expand ${group}` : `Collapse ${group}`}
      >
        {collapsed ? '▸' : '▾'}
      </button>
      {editing ? (
        <input
          className="backlog-group-rename"
          value={draft}
          autoFocus
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitRename}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            if (e.key === 'Escape') {
              setDraft(group)
              setEditing(false)
            }
          }}
        />
      ) : (
        <button
          type="button"
          className="backlog-group-name backlog-group-name-btn"
          title="Open group"
          onClick={() => openModal('groupDetail', { group })}
        >
          {group}
        </button>
      )}
      {stats && (
        <span className="backlog-group-count">
          {stats.done}/{stats.total} done
        </span>
      )}
      <span className="backlog-group-actions">
        <button
          type="button"
          className="backlog-group-action"
          onClick={() => {
            setDraft(group)
            setEditing(true)
          }}
        >
          Rename
        </button>
        <button type="button" className="backlog-group-action" onClick={() => setConfirming(true)}>
          Ungroup
        </button>
      </span>
      {stats && (
        <span className="backlog-group-progress" aria-hidden="true">
          <span className="backlog-group-progress-fill" style={{ width: `${pct}%` }} />
        </span>
      )}
      {confirming && (
        <ConfirmModal
          title="Ungroup tasks?"
          message={`This removes all ${memberIds.length} task${memberIds.length === 1 ? '' : 's'} from “${group}”. The tasks themselves are kept.`}
          confirmLabel="Ungroup"
          danger
          onConfirm={async () => {
            setConfirming(false)
            await setItemsGroup(memberIds, null)
          }}
          onCancel={() => setConfirming(false)}
        />
      )}
    </div>
  )
}
