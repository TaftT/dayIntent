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
      {filters.tab === 'todo' && (
        <div className="backlog-view-row">
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
          <button
            type="button"
            className="btn btn-subtle"
            onClick={() => openModal('categoryManager', { initialTab: 'groups' })}
            title="Add, color and reorder groups and categories"
          >
            Organize
          </button>
          <button
            type="button"
            className={`btn btn-subtle backlog-select-btn ${selecting ? 'active' : ''}`}
            onClick={onToggleSelecting}
          >
            {selecting ? 'Done selecting' : 'Select'}
          </button>
        </div>
      )}
    </div>
  )
}
