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
import { useBacklogItems } from '../../hooks/useBacklogItems.js'

export function BacklogPage() {
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)
  const reorderItem = useEntityStore((s) => s.reorderItem)
  const openModal = useAppStore((s) => s.openModal)
  const sensors = usePlannerSensors()
  const navigate = useNavigate()
  const [activeTitle, setActiveTitle] = useState(null)
  const filters = useAppStore((s) => s.backlogFilters)
  const { rows, counts } = useBacklogItems(filters)

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

    // Dropped on another row: reorder. Dropping above/below the target uses
    // the real pointer position (start position + total movement), not the
    // dragged element's rect — the handle can be grabbed anywhere in the row,
    // so the rect has an arbitrary offset from the pointer.
    const targetItemId = over.data.current?.itemId
    if (targetItemId && targetItemId !== active.id) {
      const overRect = over.rect
      const startY = activatorEvent?.touches?.[0]?.clientY ?? activatorEvent?.clientY
      const pointerY = startY != null ? startY + delta.y : null
      const ratio =
        pointerY != null && overRect && overRect.height > 0 ? (pointerY - overRect.top) / overRect.height : null
      await reorderItem(active.id, targetItemId, ratio != null && ratio <= 0.5 ? 'before' : 'after')
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
      <BacklogFilters counts={counts} />
      <DndContext
        sensors={sensors}
        collisionDetection={pointerWithin}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
      >
        <div className="backlog-page-content">
          <BacklogList rows={rows} tab={filters.tab} />
          <MiniCalendarDropTarget isDragging={Boolean(activeTitle)} />
        </div>
        {/* No drop animation: the default slides the chip back to the row's old
            position before the list reorders, which reads as a jump. */}
        <DragOverlay dropAnimation={null}>{activeTitle && <div className="drag-overlay-chip">{activeTitle}</div>}</DragOverlay>
      </DndContext>
    </div>
  )
}
