import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { ItemDetailModal } from '../itemdetail/ItemDetailModal.jsx'
import { CategoryManagerModal } from '../categories/CategoryManagerModal.jsx'
import { SearchModal } from '../search/SearchModal.jsx'
import { WeatherModal } from '../weather/WeatherModal.jsx'
import { DatePickerModal } from '../dayview/DatePickerModal.jsx'
import { QuickAddModal } from '../dayview/QuickAddModal.jsx'
import { GroupDetailModal } from '../backlog/GroupDetailModal.jsx'
import { AuthModal } from '../auth/AuthModal.jsx'
import { UnlockPrompt } from '../auth/UnlockPrompt.jsx'
import { SyncMismatchPrompt } from '../auth/SyncMismatchPrompt.jsx'
import { ReminderScheduler } from '../notifications/ReminderScheduler.jsx'
import { ToastContainer } from '../notifications/ToastContainer.jsx'
import { BottomNav } from './BottomNav.jsx'
import { SplitPane } from './SplitPane.jsx'
import { PaneContext } from '../../hooks/usePane.jsx'
import { useIsWide } from '../../hooks/useIsWide.js'
import { seedIfEmpty } from '../../data/devSeed.js'

export function AppShell({ children }) {
  const init = useEntityStore((s) => s.init)
  const initialized = useEntityStore((s) => s.initialized)
  const topUpRecurring = useEntityStore((s) => s.topUpRecurring)
  const items = useEntityStore((s) => s.items)
  const activeModal = useAppStore((s) => s.activeModal)
  const initAuth = useAuthStore((s) => s.init)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const needsUnlock = useAuthStore((s) => s.needsUnlock)
  const splitOpen = useAppStore((s) => s.splitOpen)
  const secondaryPath = useAppStore((s) => s.secondaryPath)
  const setSecondaryPath = useAppStore((s) => s.setSecondaryPath)
  const routerNavigate = useNavigate()
  const { pathname } = useLocation()
  const wide = useIsWide()
  const split = splitOpen && wide

  useEffect(() => {
    async function bootstrap() {
      if (import.meta.env.DEV) await seedIfEmpty()
      await init()
    }
    bootstrap()
    initAuth()
  }, [init, initAuth])

  // A tab or installed app left open for days still needs its recurring series
  // extended as the rolling window moves: re-check whenever it comes back into
  // view, and hourly while it stays open.
  useEffect(() => {
    if (!initialized) return undefined
    const check = () => topUpRecurring().catch(() => {})
    const onVisible = () => document.visibilityState === 'visible' && check()
    document.addEventListener('visibilitychange', onVisible)
    const timer = setInterval(check, 60 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      clearInterval(timer)
    }
  }, [initialized, topUpRecurring])

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

  // Pages navigate through their own pane. A jump to a day (e.g. "open this
  // day" on a backlog row) lands in the other pane when that one is already
  // showing a day, so a backlog beside a day drives the day.
  const isDay = (p) => p.startsWith('/day')
  const paths = { primary: pathname, secondary: secondaryPath }
  const goTo = (pane, to) => {
    const other = pane === 'primary' ? 'secondary' : 'primary'
    const target = typeof to === 'string' && isDay(to) && !isDay(paths[pane]) && isDay(paths[other]) ? other : pane
    if (target === 'primary') routerNavigate(to)
    else setSecondaryPath(to)
  }

  return (
    <div className="app-shell">
      <div className={split ? 'app-main app-main-split' : 'app-main'}>
        {split ? (
          <>
            <PaneContext.Provider value={{ id: 'primary', navigate: (to) => goTo('primary', to) }}>
              <div className="split-pane">{children}</div>
            </PaneContext.Provider>
            <PaneContext.Provider value={{ id: 'secondary', navigate: (to) => goTo('secondary', to) }}>
              <SplitPane />
            </PaneContext.Provider>
          </>
        ) : (
          children
        )}
      </div>
      <BottomNav />
      {activeModal?.type === 'itemDetail' && isOpeningLockedItem && <UnlockPrompt />}
      {activeModal?.type === 'itemDetail' && !isOpeningLockedItem && (
        <ItemDetailModal key={activeModal.props.itemId ?? 'new'} {...activeModal.props} />
      )}
      {activeModal?.type === 'categoryManager' && <CategoryManagerModal {...activeModal.props} />}
      {activeModal?.type === 'search' && <SearchModal />}
      {activeModal?.type === 'weather' && <WeatherModal />}
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
