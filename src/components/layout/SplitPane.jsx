import { AppRoutes } from '../AppRoutes.jsx'
import { useAppStore } from '../../store/useAppStore.js'

const PAGES = [
  { label: 'Day', page: 'day' },
  { label: 'Backlog', page: 'backlog' },
  { label: 'Journal', page: 'journal' },
  { label: 'Stats', page: 'stats' },
]

// The right-hand page of the desktop split view, with its own small page
// switcher (the bottom nav only drives the left pane).
export function SplitPane() {
  const path = useAppStore((s) => s.secondaryPath)
  const setPath = useAppStore((s) => s.setSecondaryPath)
  const currentDate = useAppStore((s) => s.currentDate)
  const closeSplit = useAppStore((s) => s.closeSplit)
  const page = path.split('/')[1] || ''

  return (
    <div className="split-pane split-pane-secondary">
      <div className="split-pane-bar">
        {PAGES.map((p) => (
          <button
            key={p.page}
            type="button"
            className={`split-pane-tab ${page === p.page ? 'active' : ''}`}
            onClick={() => page !== p.page && setPath(p.page === 'day' ? `/day/${currentDate}` : `/${p.page}`)}
          >
            {p.label}
          </button>
        ))}
        <button type="button" className="icon-button split-pane-close" onClick={closeSplit} aria-label="Close split view">
          ✕
        </button>
      </div>
      <div className="split-pane-body">
        <AppRoutes location={path} />
      </div>
    </div>
  )
}
