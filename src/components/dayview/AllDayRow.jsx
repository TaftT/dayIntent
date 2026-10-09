import { differenceInCalendarDays } from 'date-fns'
import { useItem } from '../../hooks/useItem.js'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { StatusCircle } from './StatusCircle.jsx'
import { getDisplayStatus } from '../../data/rollover.js'
import { contrastTextColor, UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'
import { fromDateStr, addDaysStr } from '../../utils/dateUtils.js'

// An all-day item's length is stored as whole days packed into
// durationMinutes (days * 1440). A single-day item is just 1.
function allDaySpan(instance) {
  return Math.max(1, Math.round((instance.durationMinutes ?? 1440) / 1440))
}

function AllDayChip({ instance, span }) {
  const item = useItem(instance.itemId)
  const category = useCategoryById(item?.categoryId)
  const markInstanceComplete = useEntityStore((s) => s.markInstanceComplete)
  const openModal = useAppStore((s) => s.openModal)
  const hideSynced = useAuthStore((s) => Boolean(s.user) && s.needsUnlock)
  const isHighlighted = useAppStore((s) => s.highlightItemId === instance.itemId)
  if (!item) return null
  if (hideSynced && item.syncEnabled) return null // hidden while cloud sync is locked

  const status = getDisplayStatus(instance)
  const color = category?.color ?? UNCATEGORIZED_COLOR

  return (
    <div
      data-item-id={instance.itemId}
      className={`all-day-chip status-${status}${isHighlighted ? ' highlight-flash' : ''}`}
      style={{ background: color, color: contrastTextColor(color) }}
      onClick={() =>
        openModal('itemDetail', { itemId: item.id, instanceId: instance.id, date: instance.date })
      }
    >
      <button
        className="instance-complete-toggle-inline"
        onClick={(e) => {
          e.stopPropagation()
          markInstanceComplete(instance.id)
        }}
        aria-label="Mark complete"
      >
        <StatusCircle status={status} size={15} />
      </button>
      {item.title}
      {item.googleSharedAt && <span className="gcal-badge" title="Added to Google Calendar">G</span>}
      {span && <span className="all-day-chip-span"> · day {span.index}/{span.total}</span>}
    </div>
  )
}

export function AllDayRow({ instances, date }) {
  const allInstances = useEntityStore((s) => s.allInstances)

  const startingToday = instances.filter((i) => i.isAllDay)
  const startedTodayIds = new Set(startingToday.map((i) => i.id))
  // Multi-day items that began on an earlier date but still cover today.
  const carriedOver = allInstances.filter(
    (i) =>
      i.isAllDay &&
      !startedTodayIds.has(i.id) &&
      i.date < date &&
      addDaysStr(i.date, allDaySpan(i)) > date
  )

  const chips = [...startingToday, ...carriedOver]
  if (chips.length === 0) return null

  return (
    <div className="all-day-row">
      {chips.map((instance) => {
        const total = allDaySpan(instance)
        const index = differenceInCalendarDays(fromDateStr(date), fromDateStr(instance.date)) + 1
        return (
          <AllDayChip
            key={instance.id}
            instance={instance}
            span={total > 1 ? { index, total } : null}
          />
        )
      })}
    </div>
  )
}
