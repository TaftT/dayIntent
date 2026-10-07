import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'

// Header for one group in the grouped view: name, progress, collapse, and
// rename / ungroup. `group` is null for the "No group" section.
export function BacklogGroupHeader({ group, stats, shown, collapsed, onToggle }) {
  const renameGroup = useEntityStore((s) => s.renameGroup)
  const setItemsGroup = useEntityStore((s) => s.setItemsGroup)
  const items = useEntityStore((s) => s.items)
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState(group ?? '')

  if (group === null) {
    return (
      <div className="backlog-group-header backlog-group-header-none">
        <span className="backlog-group-name">No group</span>
        <span className="backlog-group-count">{shown}</span>
      </div>
    )
  }

  const pct = stats && stats.total > 0 ? (stats.done / stats.total) * 100 : 0

  const commitRename = async () => {
    setEditing(false)
    await renameGroup(group, draft)
  }

  const ungroup = async () => {
    const ids = items.filter((i) => i.group === group).map((i) => i.id)
    await setItemsGroup(ids, null)
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
        <span className="backlog-group-name">{group}</span>
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
        <button type="button" className="backlog-group-action" onClick={ungroup} title="Remove every task from this group (nothing is deleted)">
          Ungroup
        </button>
      </span>
      {stats && (
        <span className="backlog-group-progress" aria-hidden="true">
          <span className="backlog-group-progress-fill" style={{ width: `${pct}%` }} />
        </span>
      )}
    </div>
  )
}
