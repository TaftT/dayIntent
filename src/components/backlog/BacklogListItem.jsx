import { useNavigate } from 'react-router-dom'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { ScheduleMenu } from './ScheduleMenu.jsx'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'
import { formatMinutesShort, formatShortDate, formatTimeLabel, isTodayStr } from '../../utils/dateUtils.js'

function whenLabel(instance) {
  if (!instance) return null
  const day = isTodayStr(instance.date) ? 'Today' : formatShortDate(instance.date)
  return !instance.isAllDay && instance.time ? `${day} · ${formatTimeLabel(instance.time)}` : day
}

export function BacklogListItem({ row, rank, draggable, canSchedule, selection }) {
  const { item, percent, nextInstance } = row
  const category = useCategoryById(item.categoryId)
  const navigate = useNavigate()
  const flashItem = useAppStore((s) => s.flashItem)
  const items = useEntityStore((s) => s.items)
  const group = useEntityStore((s) => s.groups.find((g) => g.id === item.groupId) ?? null)
  const setItemComplete = useEntityStore((s) => s.setItemComplete)
  const openModal = useAppStore((s) => s.openModal)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  // A synced item's content is meaningless to show (or let someone edit)
  // while sync is locked — the click still goes through openModal as usual;
  // AppShell is what actually redirects it to the unlock prompt instead of
  // the edit form, so this component only needs to know whether to mask
  // itself and refuse to be picked up as a drag source.
  const isLocked = signedIn && needsUnlock && item.syncEnabled

  // useSortable so the rest of the list slides out of the way while dragging.
  // The drag is started from the handle only (setActivatorNodeRef), so
  // scrolling and tapping the row never begin a drag by accident.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({
      id: item.id,
      data: { item, itemId: item.id },
      disabled: isLocked || !draggable,
    })

  // Deliberately not translating the actively-dragged row itself: it spans
  // the full list width, so moving it visually toward the calendar caused a
  // page-wide horizontal scrollbar. The DragOverlay (a small floating chip)
  // provides the drag visual instead; this row just dims in place.
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  const parent = item.parentIds.length > 0 ? items.find((i) => i.id === item.parentIds[0]) : null
  const childCount = item.childIds.length
  const done = percent >= 100
  const selecting = Boolean(selection?.active)
  const selected = selecting && selection.ids.includes(item.id)
  // Finished tasks show the day they were completed on the calendar. One
  // that was just checked off from the backlog has no known date, so it says
  // so instead of guessing — and has no day to link to.
  const linkDate = done ? row.completedDate : nextInstance?.date
  const when = done
    ? row.completedDate
      ? `✓ Done ${isTodayStr(row.completedDate) ? 'today' : formatShortDate(row.completedDate)}`
      : null
    : whenLabel(nextInstance)
  // A scheduled task opens with its occurrence (so the modal shows its day and
  // time and saving moves that occurrence); one that isn't on the calendar
  // opens as a plain backlog item.
  const openItem = () =>
    openModal(
      'itemDetail',
      nextInstance && !item.isUnscheduled && !item.recurrence
        ? { itemId: item.id, instanceId: nextInstance.id, date: nextInstance.date, time: nextInstance.time }
        : { itemId: item.id }
    )
  const markedFromBacklog = done && !row.completedDate

  // Synced items are hidden while sync is locked (see useBacklogItems); this
  // is just a belt-and-braces guard for any other path that renders a row.
  if (isLocked) return null

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`backlog-list-item ${done ? 'is-done' : ''} ${isDragging ? 'dragging' : ''} ${selected ? 'is-selected' : ''}`}
      onClick={() => (selecting ? selection.toggle(item.id) : openItem())}
    >
      {draggable && !selecting && (
        <button
          type="button"
          ref={setActivatorNodeRef}
          className="backlog-drag-handle"
          aria-label="Drag to reorder"
          title="Drag to reorder"
          onClick={(e) => e.stopPropagation()}
          {...listeners}
          {...attributes}
        >
          ⋮⋮
        </button>
      )}
      {rank != null && <span className="backlog-rank">{rank}</span>}
      {selecting && (
        <span className={`backlog-select-dot ${selected ? 'checked' : ''}`} aria-hidden="true">
          {selected ? '✓' : ''}
        </span>
      )}
      {/* A series has no single done state — only its occurrences do. */}
      {!selecting && !item.recurrence && (
      <button
        type="button"
        className={`backlog-check ${done ? 'checked' : ''}`}
        role="checkbox"
        aria-checked={done}
        aria-label={done ? 'Mark not done' : 'Mark done'}
        onClick={(e) => {
          e.stopPropagation()
          setItemComplete(item.id, !done)
        }}
      >
        {done ? '✓' : ''}
      </button>
      )}
      <div className="backlog-item-body">
        <span className="backlog-item-title">{item.title}</span>
        <span className="backlog-item-meta">
          <span className="category-dot" style={{ background: category?.color ?? UNCATEGORIZED_COLOR }} />
          {category && <span>{category.name}</span>}
          <span>{item.durationMinutes != null ? formatMinutesShort(item.durationMinutes) : 'Reminder'}</span>
          {markedFromBacklog && <span className="backlog-marked-done">✓ Marked done from backlog</span>}
          {item.recurrence && !nextInstance && <span>No upcoming occurrences</span>}
          {item.googleSharedAt && <span className="gcal-badge" title="Added to Google Calendar">G</span>}
          {when && (
            <button
              type="button"
              className="backlog-when"
              title="Open this day"
              onClick={(e) => {
                e.stopPropagation()
                flashItem(item.id)
                navigate(`/day/${linkDate}`)
              }}
            >
              {when}
            </button>
          )}
          {group && (
            <span className="backlog-group-chip" title="Group">
              <span className="category-dot" style={{ background: group.color }} />
              {group.name}
            </span>
          )}
          {parent && <span title="Part of">↳ {parent.title}</span>}
          {childCount > 0 && <span>{childCount} sub</span>}
        </span>
        {percent > 0 && percent < 100 && (
          <span className="backlog-progress" aria-label={`${percent}% complete`}>
            <span className="backlog-progress-fill" style={{ width: `${percent}%` }} />
          </span>
        )}
      </div>
      {percent > 0 && percent < 100 && <span className="backlog-item-percent">{percent}%</span>}
      {canSchedule && !done && !selecting && !item.recurrence && <ScheduleMenu item={item} instanceId={nextInstance?.id} />}
    </div>
  )
}
