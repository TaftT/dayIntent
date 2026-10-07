import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TopBar } from '../layout/TopBar.jsx'
import { BacklogFilters } from './BacklogFilters.jsx'
import { BacklogList } from './BacklogList.jsx'
import { MiniCalendarDropTarget } from './MiniCalendarDropTarget.jsx'
import { Button } from '../shared/Button.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { usePlannerSensors } from '../../utils/dnd/dndContextConfig.js'

// Minimum rightward drag (px) onto another row to read as "make this a
// subtask" rather than a reorder. Deliberately larger than a stray wobble.
const NEST_HORIZONTAL_PX = 40

export function BacklogPage() {
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)
  const reorderItem = useEntityStore((s) => s.reorderItem)
  const linkParentChild = useEntityStore((s) => s.linkParentChild)
  const unlinkParentChild = useEntityStore((s) => s.unlinkParentChild)
  const openModal = useAppStore((s) => s.openModal)
  const sensors = usePlannerSensors()
  const navigate = useNavigate()
  const [activeTitle, setActiveTitle] = useState(null)

  const handleDragStart = (event) => {
    setActiveTitle(event.active.data.current?.item?.title ?? null)
  }

  const handleDragEnd = async (event) => {
    setActiveTitle(null)
    const { active, over, delta, activatorEvent } = event
    if (!over) return

    const date = over.data.current?.date
    if (date) {
      // Default to noon so the item lands on the grid at a sensible spot,
      // then jump straight to that day so the user sees where it landed.
      await scheduleItemOnDate(active.id, date, {})
      navigate(`/day/${date}`)
      return
    }

    // Dropped on another backlog row. Reordering (dropping above/below the
    // target) is the overwhelmingly common gesture, so it's the default for
    // any drop that isn't clearly deliberate sideways motion — nesting as a
    // subtask only triggers when the drag moved right by a real amount.
    // Vertical-band-based disambiguation (nest if you drop near the middle
    // of the row) turned out to be unreliable in practice: ordinary human
    // drop precision on a ~44px row tends to land near the middle anyway,
    // so it kept nesting when a reorder was intended. A horizontal gesture
    // can't be hit by accident the way a vertical position can.
    const targetItemId = over.data.current?.itemId
    if (targetItemId && targetItemId !== active.id) {
      const activeItem = active.data.current?.item
      const isNestGesture = delta.x > NEST_HORIZONTAL_PX

      if (isNestGesture) {
        await linkParentChild(targetItemId, active.id)
      } else {
        // Reordering a child pulls it out of its current parent — in this
        // flat-list view a child is just an indented row, so dragging it to
        // a new position is how you un-nest it (in addition to the explicit
        // unlink button in the item modal).
        // Uses the actual pointer position (start position + total
        // movement), not the dragged element's rect — the element can be
        // grabbed anywhere within its row, so its rect has an arbitrary
        // offset from the pointer that isn't useful for a before/after split.
        const overRect = over.rect
        const startY = activatorEvent?.touches?.[0]?.clientY ?? activatorEvent?.clientY
        const pointerY = startY != null ? startY + delta.y : null
        const ratio = pointerY != null && overRect && overRect.height > 0
          ? (pointerY - overRect.top) / overRect.height
          : null
        // Reorder first so the new order shows immediately; un-nesting (which
        // involves slower writes) follows rather than delaying the drop.
        await reorderItem(active.id, targetItemId, ratio != null && ratio <= 0.5 ? 'before' : 'after')
        if (activeItem?.parentIds?.length > 0) {
          await Promise.all(activeItem.parentIds.map((parentId) => unlinkParentChild(parentId, active.id)))
        }
      }
    }
  }

  return (
    <div className="backlog-page">
      <TopBar />
      <div className="backlog-page-toolbar">
        <h1>Backlog</h1>
        <Button variant="primary" onClick={() => openModal('itemDetail', { itemId: null })}>
          + New Item
        </Button>
      </div>
      <BacklogFilters />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="backlog-page-content">
          <BacklogList />
          <MiniCalendarDropTarget isDragging={Boolean(activeTitle)} />
        </div>
        {/* No drop animation: the default slides the chip back to the row's old
            position before the list reorders, which reads as a jump. */}
        <DragOverlay dropAnimation={null}>{activeTitle && <div className="drag-overlay-chip">{activeTitle}</div>}</DragOverlay>
      </DndContext>
    </div>
  )
}
