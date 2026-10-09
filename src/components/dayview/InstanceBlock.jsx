import { useEffect, useRef } from 'react'
import { useDraggable } from '@dnd-kit/core'
import { useItem } from '../../hooks/useItem.js'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { getDisplayStatus } from '../../data/rollover.js'
import { formatTimeLabel, timeStrToMinutes } from '../../utils/dateUtils.js'
import { StatusCircle } from './StatusCircle.jsx'
import { minutesToPx, MIN_BLOCK_HEIGHT_PX, DAY_HEIGHT, overlapRightInset, overlapLeftOffset } from './gridConstants.js'
import { contrastTextColor, UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'

const REMINDER_LABEL_HEIGHT = 18
// Caps how far a block can cascade rightward when many instances overlap,
// so a busy cluster doesn't shrink blocks down to nothing on a narrow screen.
const MAX_OVERLAP_STAGGER = 6

export function InstanceBlock({ instance, date, overlapIndex = 0 }) {
  const item = useItem(instance.itemId)
  const category = useCategoryById(item?.categoryId)
  const markInstanceComplete = useEntityStore((s) => s.markInstanceComplete)
  const openModal = useAppStore((s) => s.openModal)
  const isHighlighted = useAppStore((s) => s.highlightItemId === instance.itemId)
  const isSelected = useAppStore((s) => s.selectedInstanceIds.includes(instance.id))
  const toggleInstanceSelection = useAppStore((s) => s.toggleInstanceSelection)
  // Non-zero only for selected blocks while another selected block is being
  // dragged — lets this one follow along live. Unselected blocks always read
  // 0, so they don't re-render during the drag.
  const groupFollowY = useAppStore((s) => (isSelected ? s.groupDragDeltaY : 0))
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const isLocked = signedIn && needsUnlock && Boolean(item?.syncEnabled)

  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: instance.id,
    data: { instance },
    disabled: isLocked,
  })

  // A single click opens the item; a double-click toggles it in/out of the
  // day-view multi-select. Delay the open just long enough that a
  // double-click can cancel it before it fires.
  const clickTimerRef = useRef(null)
  useEffect(() => () => clearTimeout(clickTimerRef.current), [])
  const handleClick = () => {
    if (clickTimerRef.current) return
    clickTimerRef.current = setTimeout(() => {
      clickTimerRef.current = null
      openDetail()
    }, 220)
  }
  const handleDoubleClick = (e) => {
    e.stopPropagation()
    clearTimeout(clickTimerRef.current)
    clickTimerRef.current = null
    toggleInstanceSelection(instance.id)
  }

  if (!item) return null
  // A synced item is hidden entirely while cloud sync is locked.
  if (isLocked) return null

  const cappedStagger = Math.min(overlapIndex, MAX_OVERLAP_STAGGER)
  const staggerStyle = cappedStagger > 0 ? { left: 6 + overlapLeftOffset(cappedStagger), right: 6 + overlapRightInset(cappedStagger) } : null

  const status = getDisplayStatus(instance)
  // durationMinutes is null when the item is a reminder with no duration —
  // that's a deliberate state, not missing data, so no fallback to a block size.
  const durationMinutes = instance.durationMinutes ?? item.durationMinutes ?? null
  const isReminder = durationMinutes == null
  const color = category?.color ?? UNCATEGORIZED_COLOR
  const openDetail = () =>
    openModal('itemDetail', { itemId: item.id, instanceId: instance.id, date, time: instance.time })
  const toggleComplete = (e) => {
    e.stopPropagation()
    markInstanceComplete(instance.id)
  }
  // The actively-dragged block uses dnd-kit's own transform; a selected block
  // that isn't the one under the pointer follows the published group offset.
  const followY = !isDragging && isSelected ? groupFollowY : 0
  const dragTransform = transform
    ? `translate3d(0, ${transform.y}px, 0)`
    : followY
      ? `translate3d(0, ${followY}px, 0)`
      : undefined
  const isMoving = isDragging || followY !== 0

  if (isReminder) {
    const linePx = minutesToPx(timeStrToMinutes(instance.time))
    return (
      <div
        ref={setNodeRef}
        data-item-id={instance.itemId}
        className={`instance-line status-${status}${isSelected ? ' instance-selected' : ''}${isHighlighted ? ' highlight-flash' : ''}`}
        style={{
          top: linePx - REMINDER_LABEL_HEIGHT,
          height: REMINDER_LABEL_HEIGHT,
          transform: dragTransform,
          zIndex: isMoving ? 30 : 15,
        }}
        {...listeners}
        {...attributes}
        onClick={handleClick}
        onDoubleClick={handleDoubleClick}
      >
        <div className="instance-line-label">
          <button
            className="instance-complete-toggle-inline"
            onClick={toggleComplete}
            aria-label="Mark complete"
            title="Mark complete"
          >
            <StatusCircle status={status} size={18} />
          </button>
          <span className="instance-line-title">{item.title}</span>
          {item.googleSharedAt && <span className="gcal-badge" title="Added to Google Calendar">G</span>}
          {signedIn && item.syncEnabled && (
            <span className="instance-sync-badge" title="Synced to cloud">☁</span>
          )}
          <span className="instance-line-time">{formatTimeLabel(instance.time)}</span>
        </div>
        <div className="instance-line-bar" style={{ borderColor: color }} />
      </div>
    )
  }

  const top = minutesToPx(timeStrToMinutes(instance.time))
  // An overnight item (e.g. sleep) can run past midnight — clip it at the
  // bottom of this day's grid rather than let it bleed into the blank space
  // below; the remainder renders as a continuation block at the top of
  // tomorrow's grid (see OvernightContinuationBlock).
  const height = Math.max(Math.min(minutesToPx(durationMinutes), DAY_HEIGHT - top), MIN_BLOCK_HEIGHT_PX)
  const textColor = contrastTextColor(color)
  // Sleep isn't a task to do — it reads better as a quiet texture against
  // the grid's own background than as a solid, attention-grabbing block.
  const isSleep = category?.name === 'Sleep'

  const style = {
    top,
    height,
    background: isSleep
      ? `repeating-linear-gradient(45deg, ${color}3d, ${color}3d 6px, transparent 6px, transparent 14px)`
      : status === 'ghost'
        ? 'transparent'
        : color,
    borderColor: color,
    color: isSleep ? 'var(--color-text)' : status === 'ghost' ? 'var(--color-text-muted)' : textColor,
    transform: dragTransform,
    zIndex: isMoving ? 20 : 1 + cappedStagger,
    // A block stacked on another is slightly see-through so the one beneath
    // reads through it, on top of the strips left visible at its sides.
    opacity: cappedStagger > 0 ? 0.88 : status === 'worked_on' || status === 'in_progress' ? 0.85 : 1,
    ...staggerStyle,
  }

  return (
    <div
      ref={setNodeRef}
      data-item-id={instance.itemId}
      className={`instance-block status-${status}${cappedStagger > 0 ? ' instance-block-staggered' : ''}${isSelected ? ' instance-selected' : ''}${isHighlighted ? ' highlight-flash' : ''}`}
      style={style}
      {...listeners}
      {...attributes}
      onClick={handleClick}
      onDoubleClick={handleDoubleClick}
    >
      {isSelected && <span className="instance-select-badge" aria-hidden="true">✓</span>}
      <button
        className="instance-complete-toggle"
        onClick={toggleComplete}
        aria-label="Mark complete"
        title="Mark complete"
      >
        <StatusCircle status={status} size={22} />
      </button>
      <div className="instance-block-title">
        {item.title}
        {item.googleSharedAt && <span className="gcal-badge" title="Added to Google Calendar">G</span>}
        {signedIn && item.syncEnabled && (
          <span className="instance-sync-badge" title="Synced to cloud">☁</span>
        )}
      </div>
      {height > 32 && <div className="instance-block-time">{formatTimeLabel(instance.time)}</div>}
    </div>
  )
}
