// Move up / move down buttons for one row of an ordered list. Buttons rather
// than drag handles: they work the same with a finger or a mouse and never
// fight with scrolling.
export function OrderControls({ index, count, onMove }) {
  return (
    <span className="order-controls">
      <button
        type="button"
        className="icon-button"
        onClick={() => onMove(index, index - 1)}
        disabled={index === 0}
        aria-label="Move up"
        title="Move up"
      >
        ▲
      </button>
      <button
        type="button"
        className="icon-button"
        onClick={() => onMove(index, index + 1)}
        disabled={index === count - 1}
        aria-label="Move down"
        title="Move down"
      >
        ▼
      </button>
    </span>
  )
}

/** Returns a copy of `ids` with the entry at `from` moved to `to`. */
export function moveInList(ids, from, to) {
  if (to < 0 || to >= ids.length || from === to) return ids
  const next = ids.slice()
  const [moved] = next.splice(from, 1)
  next.splice(to, 0, moved)
  return next
}
