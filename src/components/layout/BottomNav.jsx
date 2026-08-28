import { NavLink, useLocation } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { Icon } from '../shared/Icon.jsx'

// App-wide bottom navigation. Lives in the AppShell so it shows on every
// page. The Day tab points at whichever day was last viewed (falling back to
// today) so switching tabs never loses your place; it stays highlighted for
// any /day/* route, not just that one date.
export function BottomNav() {
  const currentDate = useAppStore((s) => s.currentDate)
  const { pathname } = useLocation()

  const tabs = [
    { to: `/day/${currentDate}`, label: 'Day', icon: 'day', active: pathname.startsWith('/day') },
    { to: '/backlog', label: 'Backlog', icon: 'backlog', active: pathname.startsWith('/backlog') },
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
