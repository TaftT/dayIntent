import { useEffect, useState } from 'react'
import { Button } from '../shared/Button.jsx'
import { ConfirmModal } from '../shared/ConfirmModal.jsx'
import { TopBar } from '../layout/TopBar.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { useCategoryById } from '../../hooks/useCategories.js'
import { computeHabitStats, getHabitPredecessors, getVisibleHabits } from '../../utils/habitStats.js'
import { addDaysStr, todayStr, formatShortDate } from '../../utils/dateUtils.js'
import { loadStatsRange, saveStatsRange } from '../../utils/statsRangeStorage.js'
import { UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'
import { StatsRangeControl } from './StatsRangeControl.jsx'
import { CategoryTimeSection } from './CategoryTimeSection.jsx'
import { ScreenTimeSection } from './ScreenTimeSection.jsx'
import { MoodSection } from './MoodSection.jsx'

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
  const updateItem = useEntityStore((s) => s.updateItem)
  const deleteFutureSeries = useEntityStore((s) => s.deleteFutureSeries)
  // 'untrack' keeps the recurring item on the calendar and only drops it from
  // this page; 'delete' ends the series after today — past occurrences stay
  // on the calendar, only upcoming ones are removed.
  const [confirming, setConfirming] = useState(null)
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
      <div className="habit-card-actions">
        <Button variant="subtle" onClick={() => setConfirming('untrack')}>Stop tracking</Button>
        <Button variant="subtle" onClick={() => setConfirming('delete')}>Delete</Button>
      </div>
      {confirming === 'untrack' && (
        <ConfirmModal
          title="Stop tracking this habit?"
          message={`“${item.title}” will disappear from Stats but stay on your calendar as a normal recurring item.`}
          confirmLabel="Stop tracking"
          onConfirm={() => {
            setConfirming(null)
            // Older split halves are shown as part of this card, so they stop
            // being tracked with it (otherwise they'd pop up as a new card).
            for (const prev of getHabitPredecessors(item, items)) updateItem(prev.id, { isHabit: false })
            updateItem(item.id, { isHabit: false })
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
      {confirming === 'delete' && (
        <ConfirmModal
          title="Delete this habit?"
          message={`“${item.title}” will be removed from Stats and all its upcoming occurrences deleted. Past occurrences stay on your calendar.`}
          confirmLabel="Delete"
          danger
          onConfirm={() => {
            setConfirming(null)
            // The earlier half is already capped (no upcoming occurrences), so
            // it only needs untracking; its past stays on the calendar.
            for (const prev of getHabitPredecessors(item, items)) updateItem(prev.id, { isHabit: false })
            deleteFutureSeries(item.id, addDaysStr(todayStr(), 1))
          }}
          onCancel={() => setConfirming(null)}
        />
      )}
    </div>
  )
}

export function StatsPage() {
  const items = useEntityStore((s) => s.items)
  // The time breakdowns only work with signed-in, synced data; habits work either way.
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const refreshAllInstances = useEntityStore((s) => s.refreshAllInstances)
  const refreshAllJournals = useEntityStore((s) => s.refreshAllJournals)
  // The chosen filter is remembered on this device (see statsRangeStorage).
  const [range, setRangeState] = useState(loadStatsRange)
  const setRange = (next) => {
    saveStatsRange(next)
    setRangeState(next)
  }

  useEffect(() => {
    refreshAllInstances()
    refreshAllJournals()
  }, [refreshAllInstances, refreshAllJournals])

  const habits = getVisibleHabits(items)

  return (
    <div className="stats-page">
      <TopBar />
      <div className="stats-page-content">
        <h1>Stats</h1>

        <StatsRangeControl from={range.from} to={range.to} onChange={setRange} />
        {signedIn && (
          <>
            <CategoryTimeSection from={range.from} to={range.to} />
            <ScreenTimeSection from={range.from} to={range.to} />
          </>
        )}
        <MoodSection from={range.from} to={range.to} />

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
