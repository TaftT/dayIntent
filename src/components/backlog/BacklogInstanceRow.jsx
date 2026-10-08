import { useNavigate } from 'react-router-dom'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { getDisplayStatus } from '../../data/rollover.js'
import { formatShortDate, formatTimeLabel, formatMinutesShort, isTodayStr } from '../../utils/dateUtils.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'

/** One occurrence of a recurring item's upcoming series, completable on its own. */
export function BacklogInstanceRow({ row }) {
  const { item, instance } = row
  const category = useCategoryById(item.categoryId)
  const group = useEntityStore((s) => s.groups.find((g) => g.id === item.groupId) ?? null)
  const navigate = useNavigate()
  const flashItem = useAppStore((s) => s.flashItem)
  const markInstanceComplete = useEntityStore((s) => s.markInstanceComplete)
  const openModal = useAppStore((s) => s.openModal)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const isLocked = signedIn && needsUnlock && item.syncEnabled

  const done = getDisplayStatus(instance) === 'completed'
  const dateLabel = isTodayStr(instance.date) ? 'Today' : formatShortDate(instance.date)
  const when =
    !instance.isAllDay && instance.time ? `${dateLabel} · ${formatTimeLabel(instance.time)}` : dateLabel
  const percent = instance.percentComplete

  const handleClick = () =>
    openModal('itemDetail', { itemId: item.id, instanceId: instance.id, date: instance.date, time: instance.time })

  // Synced items are hidden while sync is locked (see useBacklogItems).
  if (isLocked) return null

  return (
    <div className={`backlog-list-item ${done ? 'is-done' : ''}`} onClick={handleClick}>
      <button
        type="button"
        className={`backlog-check ${done ? 'checked' : ''}`}
        role="checkbox"
        aria-checked={done}
        aria-label="Mark this occurrence done"
        disabled={done}
        onClick={(e) => {
          e.stopPropagation()
          markInstanceComplete(instance.id)
        }}
      >
        {done ? '✓' : ''}
      </button>
      <div className="backlog-item-body">
        <span className="backlog-item-title">{item.title}</span>
        <span className="backlog-item-meta">
          <span className="category-dot" style={{ background: category?.color ?? UNCATEGORIZED_COLOR }} />
          {category && <span>{category.name}</span>}
          <span>{item.durationMinutes != null ? formatMinutesShort(item.durationMinutes) : 'Reminder'}</span>
          {item.googleSharedAt && <span className="gcal-badge" title="Added to Google Calendar">G</span>}
          {group && (
            <span className="backlog-group-chip" title="Group">
              <span className="category-dot" style={{ background: group.color }} />
              {group.name}
            </span>
          )}
          <button
            type="button"
            className="backlog-when"
            title="Open this day"
            onClick={(e) => {
              e.stopPropagation()
              flashItem(item.id)
              navigate(`/day/${instance.date}`)
            }}
          >
            ⟳ Next: {when}
          </button>
        </span>
        {percent > 0 && percent < 100 && (
          <span className="backlog-progress" aria-label={`${percent}% complete`}>
            <span className="backlog-progress-fill" style={{ width: `${percent}%` }} />
          </span>
        )}
      </div>
    </div>
  )
}
