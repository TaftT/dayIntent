import { useNavigate } from 'react-router-dom'
import { useCategoryById } from '../../hooks/useCategories.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { formatShortDate, isTodayStr, todayStr } from '../../utils/dateUtils.js'

/**
 * Where to jump for an item: its next upcoming occurrence, else the most
 * recent past one. null when it was never on the calendar (backlog only).
 */
function targetInstance(instances, itemId) {
  const mine = instances.filter((i) => i.itemId === itemId).sort((a, b) => a.date.localeCompare(b.date))
  if (mine.length === 0) return null
  const today = todayStr()
  return mine.find((i) => i.date >= today) ?? mine[mine.length - 1]
}

export function SearchResultItem({ item }) {
  const navigate = useNavigate()
  const category = useCategoryById(item.categoryId)
  const allInstances = useEntityStore((s) => s.allInstances)
  const openModal = useAppStore((s) => s.openModal)
  const closeModal = useAppStore((s) => s.closeModal)
  const flashItem = useAppStore((s) => s.flashItem)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const isLocked = signedIn && needsUnlock && item.syncEnabled

  // Synced items are hidden while cloud sync is locked.
  if (isLocked) return null

  const target = targetInstance(allInstances, item.id)

  // A scheduled item takes you to its day with the item highlighted; one that
  // only lives in the backlog has no day, so it opens for editing instead.
  const handleClick = () => {
    if (target) {
      closeModal()
      flashItem(item.id)
      navigate(`/day/${target.date}`)
    } else {
      openModal('itemDetail', { itemId: item.id })
    }
  }

  return (
    <button className="search-result-item" onClick={handleClick}>
      {category && <span className="category-dot" style={{ background: category.color }} />}
      <span className="search-result-title">{item.title}</span>
      {target ? (
        <span className="badge">{isTodayStr(target.date) ? 'Today' : formatShortDate(target.date)}</span>
      ) : (
        <span className="badge">Backlog</span>
      )}
    </button>
  )
}
