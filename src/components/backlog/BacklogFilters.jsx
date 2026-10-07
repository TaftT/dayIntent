import { useCategories } from '../../hooks/useCategories.js'
import { useAppStore } from '../../store/useAppStore.js'
import { BACKLOG_TABS } from '../../hooks/useBacklogItems.js'

export function BacklogFilters({ counts }) {
  const categories = useCategories()
  const filters = useAppStore((s) => s.backlogFilters)
  const setBacklogFilters = useAppStore((s) => s.setBacklogFilters)

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
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  )
}
