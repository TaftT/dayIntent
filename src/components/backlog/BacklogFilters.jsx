import { Icon } from '../shared/Icon.jsx'
import { useCategories } from '../../hooks/useCategories.js'
import { useAppStore } from '../../store/useAppStore.js'
import { BACKLOG_TABS, UNCATEGORIZED_FILTER } from '../../hooks/useBacklogItems.js'

export function BacklogFilters({ counts, selecting, onToggleSelecting }) {
  const categories = useCategories()
  const filters = useAppStore((s) => s.backlogFilters)
  const setBacklogFilters = useAppStore((s) => s.setBacklogFilters)
  const openModal = useAppStore((s) => s.openModal)

  return (
    <div className="backlog-controls">
      <div className="backlog-tabs" role="tablist">
        {BACKLOG_TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={filters.tab === t.id}
            className={`backlog-tab ${filters.tab === t.id ? 'active' : ''}`}
            onClick={() => setBacklogFilters({ tab: t.id })}
          >
            {t.label}
            <span className="backlog-tab-count">{counts?.[t.id] ?? 0}</span>
          </button>
        ))}
      </div>
      <div className="backlog-filters">
        <input
          type="text"
          placeholder="Search…"
          value={filters.searchText}
          onChange={(e) => setBacklogFilters({ searchText: e.target.value })}
        />
        <select
          value={filters.categoryId ?? ''}
          onChange={(e) => setBacklogFilters({ categoryId: e.target.value || null })}
          aria-label="Filter by category"
        >
          <option value="">All categories</option>
          <option value={UNCATEGORIZED_FILTER}>Uncategorized</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
      {(
        <div className="backlog-view-row">
          {/* The Groups tab is always grouped, so the toggle has nothing to switch. */}
          {filters.tab !== 'groups' ? (
          <div className="backlog-view-toggle" role="group" aria-label="View">
            {[
              ['list', 'List'],
              ['grouped', 'Grouped'],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                className={filters.view === id ? 'active' : ''}
                aria-pressed={filters.view === id}
                onClick={() => setBacklogFilters({ view: id })}
              >
                {label}
              </button>
            ))}
          </div>
          ) : (
            <span />
          )}
          <div className="backlog-view-actions">
            <button
              type="button"
              className="btn btn-subtle backlog-organize-btn"
              onClick={() => openModal('categoryManager', { initialTab: 'groups' })}
              aria-label="Organize groups and categories"
              title="Organize groups and categories"
            >
              <Icon name="categories" size={18} />
            </button>
            {/* Recurring rows are a series' next occurrence, not selectable tasks. */}
            {filters.tab !== 'recurring' && (
              <button
                type="button"
                className={`btn btn-subtle backlog-select-btn ${selecting ? 'active' : ''}`}
                onClick={onToggleSelecting}
              >
                {selecting ? 'Done selecting' : 'Select'}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
