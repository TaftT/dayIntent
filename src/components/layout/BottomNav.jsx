import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { Icon } from '../shared/Icon.jsx'
import { todayStr } from '../../utils/dateUtils.js'

// App-wide bottom navigation. Lives in the AppShell so it shows on every
// page. The Day tab points at whichever day was last viewed (falling back to
// today) so switching tabs never loses your place; it stays highlighted for
// any /day/* route, not just that one date. Tapping Day while already on a
// day page jumps back to today.
export function BottomNav() {
  const currentDate = useAppStore((s) => s.currentDate)
  const { pathname } = useLocation()

  const onDayPage = pathname.startsWith('/day')

  const tabs = [
    { to: `/day/${onDayPage ? todayStr() : currentDate}`, label: 'Day', icon: 'day', active: pathname.startsWith('/day') },
    { to: '/backlog', label: 'Backlog', icon: 'backlog', active: pathname.startsWith('/backlog') },
    { to: '/journal', label: 'Journal', icon: 'journal', active: pathname.startsWith('/journal') },
    { to: '/stats', label: 'Stats', icon: 'stats', active: pathname.startsWith('/stats') },
  ]

  return (
    <nav className="bottom-nav">
      {tabs.map((tab) => (
        <NavLink
          key={tab.label}
          to={tab.to}
          className={tab.active ? 'bottom-nav-tab active' : 'bottom-nav-tab'}
        >
          <Icon name={tab.icon} size={22} />
          <span>{tab.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}
