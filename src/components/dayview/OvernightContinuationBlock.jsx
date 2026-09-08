import { useItem } from '../../hooks/useItem.js'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useAppStore } from '../../store/useAppStore.js'
import { getDisplayStatus } from '../../data/rollover.js'
import { minutesToPx, MIN_BLOCK_HEIGHT_PX } from './gridConstants.js'
import { contrastTextColor, UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'

/**
 * The portion of yesterday's overnight item (e.g. sleep) that runs past
 * midnight into today — rendered from the top of the grid down to the end
 * time, so an 11 PM–7 AM block visibly continues onto the next day.
 * Not draggable: dragging would ambiguously span two different dates, so
 * editing (including moving the start time) happens through the modal.
 */
export function OvernightContinuationBlock({ continuation }) {
  const item = useItem(continuation.itemId)
  const category = useCategoryById(item?.categoryId)
  const openModal = useAppStore((s) => s.openModal)

  if (!item) return null

  const status = getDisplayStatus(continuation)
  const color = category?.color ?? UNCATEGORIZED_COLOR
  const textColor = contrastTextColor(color)
  const height = Math.max(minutesToPx(continuation.overflowMinutes), MIN_BLOCK_HEIGHT_PX)
  const isSleep = category?.name === 'Sleep'

  const style = {
    top: 0,
    height,
    background: isSleep
      ? `repeating-linear-gradient(45deg, ${color}3d, ${color}3d 6px, transparent 6px, transparent 14px)`
      : status === 'ghost'
        ? 'transparent'
        : color,
    borderColor: color,
    color: isSleep ? 'var(--color-text)' : status === 'ghost' ? 'var(--color-text-muted)' : textColor,
    opacity: status === 'worked_on' || status === 'in_progress' ? 0.85 : 1,
  }

  return (
    <div
      className={`instance-block instance-continuation status-${status}`}
      style={style}
      onClick={() =>
        openModal('itemDetail', {
          itemId: item.id,
          instanceId: continuation.id,
          date: continuation.originalDate,
          time: continuation.time,
        })
      }
    >
      <div className="instance-block-title">↳ {item.title}</div>
    </div>
  )
}
