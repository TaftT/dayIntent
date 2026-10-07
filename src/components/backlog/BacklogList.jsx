import { Fragment } from 'react'
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { BacklogListItem } from './BacklogListItem.jsx'
import { BacklogInstanceRow } from './BacklogInstanceRow.jsx'
import { BacklogQuickAdd } from './BacklogQuickAdd.jsx'

const EMPTY_TEXT = {
  todo: 'Nothing to do — add a task above.',
  scheduled: 'Nothing scheduled. Schedule a task from your To do list.',
  recurring: 'No recurring tasks yet.',
  progress: 'Nothing in progress.',
  done: 'Nothing completed yet.',
}

// Only the To do tab is a priority list, so only there can rows be dragged to
// reorder (or onto the calendar to schedule).
export function BacklogList({ rows, tab }) {
  const draggable = tab === 'todo'
  const sortableIds = rows.filter((row) => row.type === 'item').map((row) => row.item.id)
  let lastSection = null

  return (
    <SortableContext items={sortableIds} strategy={verticalListSortingStrategy}>
      <div className="backlog-list">
        {tab === 'todo' && <BacklogQuickAdd />}
        {rows.length === 0 && <div className="empty-state">{EMPTY_TEXT[tab]}</div>}
        {rows.map((row, index) => {
          const rowEl =
            row.type === 'instance' ? (
              <BacklogInstanceRow key={row.instance.id} row={row} />
            ) : (
              <BacklogListItem key={row.item.id} row={row} rank={draggable ? index + 1 : null} draggable={draggable} />
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
        })}
      </div>
    </SortableContext>
  )
}
