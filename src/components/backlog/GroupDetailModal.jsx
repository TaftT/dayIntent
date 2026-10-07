import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { ConfirmModal } from '../shared/ConfirmModal.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useCategories } from '../../hooks/useCategories.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'
import { formatShortDate, isTodayStr } from '../../utils/dateUtils.js'

const MAX_SEARCH_RESULTS = 6

// Everything in one group — every task whatever its status — with the
// controls to add tasks to it (new or existing), take them out, rename the
// group or ungroup it.
export function GroupDetailModal({ group: initialGroup }) {
  const items = useEntityStore((s) => s.items)
  const allInstances = useEntityStore((s) => s.allInstances)
  const createItem = useEntityStore((s) => s.createItem)
  const setItemsGroup = useEntityStore((s) => s.setItemsGroup)
  const renameGroup = useEntityStore((s) => s.renameGroup)
  const setItemComplete = useEntityStore((s) => s.setItemComplete)
  const closeModal = useAppStore((s) => s.closeModal)
  const openModal = useAppStore((s) => s.openModal)
  const categories = useCategories()

  const [group, setGroup] = useState(initialGroup)
  const [renaming, setRenaming] = useState(false)
  const [draft, setDraft] = useState(initialGroup)
  const [newTitle, setNewTitle] = useState('')
  const [search, setSearch] = useState('')
  const [confirmUngroup, setConfirmUngroup] = useState(false)

  const members = items
    .filter((i) => i.group === group)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))

  // Where a member stands: its upcoming occurrence if scheduled, otherwise
  // the item's own progress.
  const statusOf = (item) => {
    if (item.recurrence) return { label: 'Recurring', done: false }
    const next = allInstances
      .filter((i) => i.itemId === item.id && !i.finalized)
      .sort((a, b) => a.date.localeCompare(b.date))[0]
    if (!item.isUnscheduled && next) {
      return {
        label: isTodayStr(next.date) ? 'Today' : formatShortDate(next.date),
        done: (next.percentComplete ?? 0) >= 100,
      }
    }
    const done = (item.percentComplete ?? 0) >= 100
    return { label: done ? 'Done' : 'To do', done }
  }

  const doneCount = members.filter((m) => statusOf(m).done).length
  const q = search.trim().toLowerCase()
  const candidates = q
    ? items
        .filter((i) => i.group !== group && !i.recurrence && i.title.toLowerCase().includes(q))
        .slice(0, MAX_SEARCH_RESULTS)
    : []

  const addNew = async (e) => {
    e.preventDefault()
    const title = newTitle.trim()
    if (!title) return
    setNewTitle('')
    await createItem({ title, durationMinutes: 30, isUnscheduled: true, group })
  }

  const commitRename = async () => {
    setRenaming(false)
    const name = draft.trim()
    if (name && name !== group) {
      await renameGroup(group, name)
      setGroup(name)
    }
  }

  const ungroupAll = async () => {
    await setItemsGroup(
      members.map((m) => m.id),
      null
    )
    closeModal()
  }

  const colorFor = (item) => categories.find((c) => c.id === item.categoryId)?.color ?? UNCATEGORIZED_COLOR

  return (
    <>
      <Modal title={group} onClose={closeModal} width={480}>
        <div className="group-detail">
          <div className="group-detail-summary">
            <span>
              {doneCount}/{members.length} done
            </span>
            {renaming ? (
              <input
                className="backlog-group-rename"
                value={draft}
                autoFocus
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitRename}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur()
                  if (e.key === 'Escape') setRenaming(false)
                }}
              />
            ) : (
              <button
                type="button"
                className="backlog-group-action"
                onClick={() => {
                  setDraft(group)
                  setRenaming(true)
                }}
              >
                Rename
              </button>
            )}
            <button type="button" className="backlog-group-action" onClick={() => setConfirmUngroup(true)}>
              Ungroup
            </button>
          </div>

          <div className="group-detail-list">
            {members.length === 0 && <div className="empty-state">No tasks in this group.</div>}
            {members.map((item) => {
              const status = statusOf(item)
              return (
                <div key={item.id} className={`group-detail-row ${status.done ? 'is-done' : ''}`}>
                  {!item.recurrence && (
                    <button
                      type="button"
                      className={`backlog-check ${status.done ? 'checked' : ''}`}
                      role="checkbox"
                      aria-checked={status.done}
                      aria-label={status.done ? 'Mark not done' : 'Mark done'}
                      onClick={() => setItemComplete(item.id, !status.done)}
                    >
                      {status.done ? '✓' : ''}
                    </button>
                  )}
                  <span className="category-dot" style={{ background: colorFor(item) }} />
                  <button
                    type="button"
                    className="group-detail-title"
                    onClick={() => openModal('itemDetail', { itemId: item.id })}
                  >
                    {item.title}
                  </button>
                  <span className="group-detail-status">{status.label}</span>
                  <button
                    type="button"
                    className="icon-button"
                    aria-label={`Remove ${item.title} from group`}
                    title="Remove from group"
                    onClick={() => setItemsGroup([item.id], null)}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>

          <form className="group-picker-new" onSubmit={addNew}>
            <input
              type="text"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              placeholder={`New task in ${group}…`}
              aria-label="New task in this group"
            />
            <button type="submit" className="btn btn-primary" disabled={!newTitle.trim()}>
              Add
            </button>
          </form>

          <div className="group-detail-add-existing">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Add an existing task — search by title…"
              aria-label="Search tasks to add"
            />
            {candidates.map((item) => (
              <div key={item.id} className="group-detail-row">
                <span className="category-dot" style={{ background: colorFor(item) }} />
                <span className="group-detail-title-static">{item.title}</span>
                {item.group && <span className="group-detail-status">in {item.group}</span>}
                <button
                  type="button"
                  className="btn btn-subtle"
                  onClick={async () => {
                    await setItemsGroup([item.id], group)
                    setSearch('')
                  }}
                >
                  Add
                </button>
              </div>
            ))}
            {q && candidates.length === 0 && <div className="group-picker-label">No matching tasks.</div>}
          </div>
        </div>
      </Modal>
      {confirmUngroup && (
        <ConfirmModal
          title="Ungroup tasks?"
          message={`This removes all ${members.length} task${members.length === 1 ? '' : 's'} from “${group}”. The tasks themselves are kept.`}
          confirmLabel="Ungroup"
          danger
          onConfirm={ungroupAll}
          onCancel={() => setConfirmUngroup(false)}
        />
      )}
    </>
  )
}
