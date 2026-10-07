// Drag handle for one row of a drag-to-reorder list. Only the handle starts a
// drag, so scrolling the list and tapping the row's other controls never do.
export function DragHandle({ setActivatorNodeRef, listeners, attributes, label = 'Drag to reorder' }) {
  return (
    <button
      type="button"
      ref={setActivatorNodeRef}
      className="order-handle"
      aria-label={label}
      title={label}
      {...listeners}
      {...attributes}
    >
      ⋮⋮
    </button>
  )
}
