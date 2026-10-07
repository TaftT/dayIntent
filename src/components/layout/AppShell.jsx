import { useEffect } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { ItemDetailModal } from '../itemdetail/ItemDetailModal.jsx'
import { CategoryManagerModal } from '../categories/CategoryManagerModal.jsx'
import { SearchModal } from '../search/SearchModal.jsx'
import { DatePickerModal } from '../dayview/DatePickerModal.jsx'
import { QuickAddModal } from '../dayview/QuickAddModal.jsx'
import { GroupDetailModal } from '../backlog/GroupDetailModal.jsx'
import { AuthModal } from '../auth/AuthModal.jsx'
import { UnlockPrompt } from '../auth/UnlockPrompt.jsx'
import { SyncMismatchPrompt } from '../auth/SyncMismatchPrompt.jsx'
import { ReminderScheduler } from '../notifications/ReminderScheduler.jsx'
import { ToastContainer } from '../notifications/ToastContainer.jsx'
import { BottomNav } from './BottomNav.jsx'
import { seedIfEmpty } from '../../data/devSeed.js'

export function AppShell({ children }) {
  const init = useEntityStore((s) => s.init)
  const initialized = useEntityStore((s) => s.initialized)
  const items = useEntityStore((s) => s.items)
  const activeModal = useAppStore((s) => s.activeModal)
  const initAuth = useAuthStore((s) => s.init)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)

  useEffect(() => {
    async function bootstrap() {
      if (import.meta.env.DEV) await seedIfEmpty()
      await init()
    }
    bootstrap()
    initAuth()
  }, [init, initAuth])

  if (!initialized) {
    return <div className="app-loading">Loading…</div>
  }

  // A single gate for every path that can open an existing item's detail
  // (backlog rows, day-grid blocks, search results, parent/child chips, …):
  // if it's a synced item and cloud sync is locked, redirect to the unlock
  // prompt instead of the edit form, rather than teaching every one of those
  // call sites about lock state individually.
  const openingItemId = activeModal?.type === 'itemDetail' ? activeModal.props.itemId : null
  const openingItem = openingItemId ? items.find((i) => i.id === openingItemId) : null
  const isOpeningLockedItem = signedIn && needsUnlock && Boolean(openingItem?.syncEnabled)

  return (
    <div className="app-shell">
      <div className="app-main">{children}</div>
      <BottomNav />
      {activeModal?.type === 'itemDetail' && isOpeningLockedItem && <UnlockPrompt />}
      {activeModal?.type === 'itemDetail' && !isOpeningLockedItem && (
        <ItemDetailModal key={activeModal.props.itemId ?? 'new'} {...activeModal.props} />
      )}
      {activeModal?.type === 'categoryManager' && <CategoryManagerModal {...activeModal.props} />}
      {activeModal?.type === 'search' && <SearchModal />}
      {activeModal?.type === 'quickAdd' && <QuickAddModal {...activeModal.props} />}
      {activeModal?.type === 'datePicker' && <DatePickerModal {...activeModal.props} />}
      {activeModal?.type === 'groupDetail' && (
        <GroupDetailModal key={activeModal.props.groupId} {...activeModal.props} />
      )}
      {activeModal?.type === 'auth' && <AuthModal />}
      {activeModal?.type === 'unlock' && <UnlockPrompt />}
      {activeModal?.type === 'syncMismatch' && <SyncMismatchPrompt />}
      <ReminderScheduler />
      <ToastContainer />
    </div>
  )
}
