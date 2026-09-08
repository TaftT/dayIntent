import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'

export function BacklogListItem({ item }) {
  const category = useCategoryById(item.categoryId)
  const items = useEntityStore((s) => s.items)
  const openModal = useAppStore((s) => s.openModal)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  // A synced item's content is meaningless to show (or let someone edit)
  // while sync is locked — the click still goes through openModal as usual;
  // AppShell is what actually redirects it to the unlock prompt instead of
  // the edit form, so this component only needs to know whether to mask
  // itself and refuse to be picked up as a drag source.
  const isLocked = signedIn && needsUnlock && item.syncEnabled

  // useSortable (not plain useDraggable/useDroppable) so the rest of the
  // list gets @dnd-kit/sortable's built-in FLIP animation as rows make room
  // for the one being dragged — that's what fixes the old "snaps back then
  // switches" jump: rows now slide smoothly both during the drag and when
  // settling into their final order after drop. It's still one droppable id
  // (`item.id`) shared with the draggable role, which BacklogPage's
  // onDragEnd relies on via `data.itemId` to decide reorder vs. nest.
  const { attributes, listeners, setNodeRef, transform, transition, isDragging, isOver } = useSortable({
    id: item.id,
    data: { item, itemId: item.id },
    disabled: isLocked,
  })

  // Deliberately not translating the actively-dragged row itself: it spans
  // the full list width, so moving it visually toward the calendar caused a
  // page-wide horizontal scrollbar. The DragOverlay (a small floating chip)
  // provides the drag visual instead; this row just dims in place. Other
  // rows (isDragging false) DO get their sortable transform, which is what
  // makes them slide out of the way smoothly.
  const style = {
    transform: isDragging ? undefined : CSS.Transform.toString(transform),
    transition,
  }

  const parent = item.parentIds.length > 0 ? items.find((i) => i.id === item.parentIds[0]) : null
  const childCount = item.childIds.length

  if (isLocked) {
    return (
      <div
        ref={setNodeRef}
        style={style}
        className="backlog-list-item item-locked"
        onClick={() => openModal('itemDetail', { itemId: item.id })}
      >
        <span aria-hidden="true">🔒</span>
        <span className="backlog-item-title">Locked until you unlock sync</span>
      </div>
    )
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`backlog-list-item ${parent ? 'backlog-item-is-child' : ''} ${isDragging ? 'dragging' : ''} ${isOver ? 'drop-target-active' : ''}`}
      {...listeners}
      {...attributes}
      onClick={() => openModal('itemDetail', { itemId: item.id })}
    >
      {parent && <span className="backlog-child-connector">↳</span>}
      <span className="category-dot" style={{ background: category?.color ?? UNCATEGORIZED_COLOR }} />
      <span className="backlog-item-title">{item.title}</span>
      {parent && <span className="badge backlog-parent-label" title="Parent task">of {parent.title}</span>}
      {childCount > 0 && (
        <span className="badge" title={`${childCount} subtask${childCount === 1 ? '' : 's'}`}>
          {childCount} sub
        </span>
      )}
      {!item.isUnscheduled && <span className="badge" title="Already on the calendar">Scheduled</span>}
      {item.recurrence && <span className="badge" title="Recurring">⟳</span>}
      {signedIn && item.syncEnabled && <span className="badge" title="Synced to cloud">☁</span>}
      {item.durationMinutes != null ? (
        <span className="backlog-item-duration">{item.durationMinutes}m</span>
      ) : (
        <span className="badge">Reminder</span>
      )}
      <span className="backlog-item-percent">{item.percentComplete}%</span>
    </div>
  )
}
