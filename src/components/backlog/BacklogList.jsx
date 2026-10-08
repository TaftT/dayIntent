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
 * Splits the To do rows into group sections in the order set in Organize,
 * then the ungrouped tasks last. Rows arrive in global priority order, so
 * tasks stay in priority order inside each section, and each keeps its global
 * rank so the interleaving across groups stays visible. Groups with no tasks
 * to show still get a (empty) section unless a search/filter is narrowing the
 * list, so a group you just created is visible.
 */
function buildGroupSections(rows, groups, showEmpty) {
  const known = new Set(groups.map((g) => g.id))
  const byGroup = new Map()
  const loose = []
  rows.forEach((row, index) => {
    const entry = { row, rank: index + 1 }
    const id = row.item.groupId
    if (id && known.has(id)) {
      if (!byGroup.has(id)) byGroup.set(id, [])
      byGroup.get(id).push(entry)
    } else {
      loose.push(entry)
    }
  })
  const sections = groups
    .filter((g) => showEmpty || byGroup.has(g.id))
    .map((group) => ({ group, entries: byGroup.get(group.id) ?? [] }))
  if (loose.length > 0 || sections.length === 0) sections.push({ group: null, entries: loose })
  return sections
}

export function BacklogList({ rows: allRows, tab, view, groups, groupStats, filtersActive, selection }) {
  const [doneLimit, setDoneLimit] = useState(DONE_PAGE_SIZE)
  const [collapsed, setCollapsed] = useState(() => new Set())
  // Only the To do tab is a priority list, so only there can rows be dragged.
  const draggable = tab === 'todo' && !selection.active
  // Grouping applies on every tab (Scheduled, In progress, Done, Recurring too);
  // only the To do tab is a priority list, so only it shows rank numbers and
  // lists empty groups.
  const grouped = view === 'grouped'
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

  const renderItem = (row, rank) =>
    row.type === 'instance' ? (
      <BacklogInstanceRow key={row.instance.id} row={row} />
    ) : (
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
    // A group with nothing to show is only listed on the To do tab (so a group
    // you just made is visible there); other tabs list the groups that have rows.
    const sections = buildGroupSections(rows, groups, tab === 'todo' && !filtersActive)
    const hasNamedGroups = sections.some((s) => s.group)
    body = sections.map(({ group, entries }) => {
      const isCollapsed = group !== null && collapsed.has(group.id)
      return (
        // A named group is drawn as one card (header + its tasks inside), so
        // it reads as a unit rather than a header floating over a flat list.
        <div key={group?.id ?? '__none__'} className={group ? 'backlog-group' : 'backlog-group-loose'}
          style={group ? { borderLeftColor: group.color } : undefined}
        >
          {(group || hasNamedGroups) && (
            <BacklogGroupHeader
              group={group}
              stats={group ? groupStats[group.id] : null}
              shown={entries.length}
              collapsed={isCollapsed}
              onToggle={group ? () => toggleCollapsed(group.id) : null}
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
        {rows.length === 0 && !(grouped && tab === 'todo' && groups.length > 0 && !filtersActive) && (
          <div className="empty-state">{EMPTY_TEXT[tab]}</div>
        )}
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
