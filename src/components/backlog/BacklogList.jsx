import { Fragment, useState } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { BacklogListItem } from './BacklogListItem.jsx'
import { BacklogInstanceRow } from './BacklogInstanceRow.jsx'
import { BacklogQuickAdd } from './BacklogQuickAdd.jsx'
import { BacklogGroupHeader } from './BacklogGroupHeader.jsx'

const EMPTY_TEXT = {
  todo: 'Nothing to do — add a task above.',
  scheduled: 'Nothing scheduled. Schedule a task from your To do list.',
  recurring: 'No recurring tasks yet.',
  progress: 'Nothing in progress.',
  done: 'Nothing completed yet.',
}

// The Done tab can grow without bound, so it only renders the most recent
// completions and loads older ones on request. Nothing is deleted.
const DONE_PAGE_SIZE = 25

/**
 * Splits the To do rows into group sections: named groups first, A→Z, then
 * the ungrouped tasks. Rows arrive in global priority order, so tasks stay in
 * priority order inside each section, and each keeps its global rank so the
 * interleaving across groups stays visible.
 */
function buildGroupSections(rows) {
  const sections = new Map()
  rows.forEach((row, index) => {
    const key = row.item.group ?? null
    if (!sections.has(key)) sections.set(key, [])
    sections.get(key).push({ row, rank: index + 1 })
  })
  return Array.from(sections, ([group, entries]) => ({ group, entries })).sort((a, b) => {
    if (a.group === null) return 1
    if (b.group === null) return -1
    return a.group.localeCompare(b.group, undefined, { sensitivity: 'base' })
  })
}

export function BacklogList({ rows: allRows, tab, view, groupStats, selection }) {
  const [doneLimit, setDoneLimit] = useState(DONE_PAGE_SIZE)
  const [collapsed, setCollapsed] = useState(() => new Set())
  // Only the To do tab is a priority list, so only there can rows be dragged.
  const draggable = tab === 'todo' && !selection.active
  const grouped = tab === 'todo' && view === 'grouped'
  const rows = tab === 'done' ? allRows.slice(0, doneLimit) : allRows
  const hiddenDone = tab === 'done' ? allRows.length - rows.length : 0
  const sortableIds = rows.filter((row) => row.type === 'item').map((row) => row.item.id)
  const canSchedule = tab === 'todo' || tab === 'scheduled' || tab === 'progress'
  let lastSection = null

  const toggleCollapsed = (group) =>
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(group)) next.delete(group)
      else next.add(group)
      return next
    })

  const renderItem = (row, rank) => (
    <BacklogListItem
      key={row.item.id}
      row={row}
      rank={tab === 'todo' ? rank : null}
      draggable={draggable}
      canSchedule={canSchedule}
      selection={selection}
    />
  )

  let body
  if (grouped) {
    const sections = buildGroupSections(rows)
    const hasNamedGroups = sections.some((s) => s.group)
    body = sections.map(({ group, entries }) => {
      const isCollapsed = group !== null && collapsed.has(group)
      return (
        // A named group is drawn as one card (header + its tasks inside), so
        // it reads as a unit rather than a header floating over a flat list.
        <div key={group ?? '__none__'} className={group ? 'backlog-group' : 'backlog-group-loose'}>
          {(group || hasNamedGroups) && (
            <BacklogGroupHeader
              group={group}
              stats={group ? groupStats[group] : null}
              shown={entries.length}
              collapsed={isCollapsed}
              onToggle={group ? () => toggleCollapsed(group) : null}
            />
          )}
          {!isCollapsed && <div className="backlog-group-body">{entries.map(({ row, rank }) => renderItem(row, rank))}</div>}
        </div>
      )
    })
  } else {
    body = rows.map((row, index) => {
      const rowEl =
        row.type === 'instance' ? (
          <BacklogInstanceRow key={row.instance.id} row={row} />
        ) : (
          renderItem(row, index + 1)
        )

      if (row.section && row.section !== lastSection) {
        lastSection = row.section
        return (
          <Fragment key={`section-${row.section}`}>
            <div className="backlog-section-header">{row.section}</div>
            {rowEl}
          </Fragment>
        )
      }
      return rowEl
    })
  }

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div className="backlog-list">
        {tab === 'todo' && !selection.active && <BacklogQuickAdd />}
        {rows.length === 0 && <div className="empty-state">{EMPTY_TEXT[tab]}</div>}
        {body}
        {hiddenDone > 0 && (
          <button
            type="button"
            className="btn btn-subtle backlog-show-more"
            onClick={() => setDoneLimit((n) => n + DONE_PAGE_SIZE)}
          >
            Show {Math.min(DONE_PAGE_SIZE, hiddenDone)} older ({hiddenDone} more)
          </button>
        )}
      </div>
    </SortableContext>
  )
}
