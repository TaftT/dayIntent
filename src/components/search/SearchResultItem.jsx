import { useCategoryById } from '../../hooks/useCategories.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'

export function SearchResultItem({ item }) {
  const category = useCategoryById(item.categoryId)
  const openModal = useAppStore((s) => s.openModal)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const isLocked = signedIn && needsUnlock && item.syncEnabled

  // Synced items are hidden while cloud sync is locked.
  if (isLocked) return null

  return (
    <button className="search-result-item" onClick={() => openModal('itemDetail', { itemId: item.id })}>
      {category && <span className="category-dot" style={{ background: category.color }} />}
      <span className="search-result-title">{item.title}</span>
      {item.isUnscheduled && <span className="badge">Backlog</span>}
    </button>
  )
}
