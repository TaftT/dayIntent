import { useEffect, useState } from 'react'
import { TopBar } from '../layout/TopBar.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useCategoryById } from '../../hooks/useCategories.js'
import { computeHabitStats } from '../../utils/habitStats.js'
import { formatShortDate } from '../../utils/dateUtils.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'
import { StatsRangeControl, rangeForPresetDays } from './StatsRangeControl.jsx'
import { CategoryTimeSection } from './CategoryTimeSection.jsx'
import { ScreenTimeSection } from './ScreenTimeSection.jsx'

const STATUS_COLOR = {
  completed: 'var(--color-primary)',
  worked_on: '#e0973b',
  ghost: 'var(--color-ghost)',
}

function HabitHistoryStrip({ history }) {
  return (
    <div className="habit-history-strip">
      {history.map((day) => (
        <div
          key={day.date}
          className="habit-history-dot"
          style={{ background: day.status ? STATUS_COLOR[day.status] : 'var(--color-bg-alt)' }}
          title={`${formatShortDate(day.date)}${day.status ? `: ${day.status.replace('_', ' ')}` : ''}`}
        />
      ))}
    </div>
  )
}

function HabitCard({ item }) {
  const category = useCategoryById(item.categoryId)
  const allInstances = useEntityStore((s) => s.allInstances)
  const items = useEntityStore((s) => s.items)
  const stats = computeHabitStats(item, items, allInstances)

  return (
    <div className="habit-card">
      <div className="habit-card-header">
        <span className="category-dot" style={{ background: category?.color ?? UNCATEGORIZED_COLOR }} />
        <span className="habit-card-title">{item.title}</span>
      </div>
      <div className="habit-card-stats">
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.currentStreak}</span>
          <span className="habit-stat-label">Current streak</span>
        </div>
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.longestStreak}</span>
          <span className="habit-stat-label">Longest streak</span>
        </div>
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.completionRate}%</span>
          <span className="habit-stat-label">Completion rate</span>
        </div>
        <div className="habit-stat">
          <span className="habit-stat-value">{stats.completedCount}/{stats.totalOccurrences}</span>
          <span className="habit-stat-label">Completed</span>
        </div>
      </div>
      <HabitHistoryStrip history={stats.history} />
    </div>
  )
}

export function StatsPage() {
  const items = useEntityStore((s) => s.items)
  const refreshAllInstances = useEntityStore((s) => s.refreshAllInstances)
  const refreshAllJournals = useEntityStore((s) => s.refreshAllJournals)
  const [range, setRange] = useState(() => rangeForPresetDays(7))

  useEffect(() => {
    refreshAllInstances()
    refreshAllJournals()
  }, [refreshAllInstances, refreshAllJournals])

  const habits = items.filter((i) => i.isHabit && i.recurrence)

  return (
    <div className="stats-page">
      <TopBar />
      <div className="stats-page-content">
        <h1>Stats</h1>

        <StatsRangeControl from={range.from} to={range.to} onChange={setRange} />
        <CategoryTimeSection from={range.from} to={range.to} />
        <ScreenTimeSection from={range.from} to={range.to} />

        <section className="stats-section">
          <div className="stats-section-header">
            <h2>Habits</h2>
          </div>
          {habits.length === 0 ? (
            <div className="empty-state">
              No habits yet. Turn on "Track as habit" on a recurring item to see its stats here.
            </div>
          ) : (
            <div className="habit-card-list">
              {habits.map((item) => (
                <HabitCard key={item.id} item={item} />
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
