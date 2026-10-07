import { DndContext, DragOverlay, pointerWithin } from '@dnd-kit/core'
import { useState } from 'react'
import { TopBar } from '../layout/TopBar.jsx'
import { BacklogFilters } from './BacklogFilters.jsx'
import { BacklogList } from './BacklogList.jsx'
import { Icon } from '../shared/Icon.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { usePlannerSensors } from '../../utils/dnd/dndContextConfig.js'
import { useBacklogItems } from '../../hooks/useBacklogItems.js'

export function BacklogPage() {
  const reorderItem = useEntityStore((s) => s.reorderItem)
  const openModal = useAppStore((s) => s.openModal)
  const sensors = usePlannerSensors()
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

    // Dropped on another row: reorder (scheduling is done from each row's
    // calendar button, not by dragging). Dropping above/below the target uses
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
        </div>
        {/* No drop animation: the default slides the chip back to the row's old
            position before the list reorders, which reads as a jump. */}
        <DragOverlay dropAnimation={null}>{activeTitle && <div className="drag-overlay-chip">{activeTitle}</div>}</DragOverlay>
      </DndContext>
      <button
        className="fab"
        onClick={() => openModal('itemDetail', { itemId: null })}
        aria-label="New item"
      >
        <Icon name="plus" size={24} />
      </button>
    </div>
  )
}
