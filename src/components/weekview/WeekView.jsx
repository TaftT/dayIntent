import { useEffect, useMemo, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { usePaneNavigate } from '../../hooks/usePane.jsx'
import { useCanShowWeek } from '../../hooks/useIsWide.js'
import { TopBar } from '../layout/TopBar.jsx'
import { AllDayRow } from '../dayview/AllDayRow.jsx'
import { StatusCircle } from '../dayview/StatusCircle.jsx'
import { CurrentTimeIndicator } from '../dayview/CurrentTimeIndicator.jsx'
import { Icon } from '../shared/Icon.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useAuthStore } from '../../store/useAuthStore.js'
import { getDisplayStatus } from '../../data/rollover.js'
import { contrastTextColor, UNCATEGORIZED_COLOR } from '../../utils/colorUtils.js'
import { addDaysStr, formatTimeLabel, isTodayStr, minutesToTimeStr, timeStrToMinutes, todayStr, fromDateStr } from '../../utils/dateUtils.js'
import { format } from 'date-fns'
import { computeLanes } from './weekLayout.js'

// The week view is its own, tighter grid: seven columns have to fit side by
// side, and a landscape phone is short, so hours are about 60% of the day
// view's height. Time-to-pixel math here is local to this view.
export const WEEK_HOUR_HEIGHT = 52
const PX_PER_MIN = WEEK_HOUR_HEIGHT / 60
const WEEK_DAY_HEIGHT = 24 * WEEK_HOUR_HEIGHT
const MIN_BLOCK_PX = 18
const REMINDER_PX = 16
const HOURS = Array.from({ length: 24 }, (_, h) => h)

function WeekBlock({ instance, item, category, date, lane, lanes, overflowMinutes = null }) {
  const markInstanceComplete = useEntityStore((s) => s.markInstanceComplete)
  const openModal = useAppStore((s) => s.openModal)
  const signedIn = useAuthStore((s) => Boolean(s.user))
  const status = getDisplayStatus(instance)
  const color = category?.color ?? UNCATEGORIZED_COLOR
  const isSleep = category?.name === 'Sleep'
  const duration = instance.durationMinutes ?? item.durationMinutes ?? null
  const isReminder = overflowMinutes == null && duration == null

  const startMin = overflowMinutes != null ? 0 : timeStrToMinutes(instance.time)
  const top = startMin * PX_PER_MIN
  const spanMin = overflowMinutes ?? duration ?? 0
  const height = isReminder
    ? REMINDER_PX
    : Math.max(Math.min(spanMin * PX_PER_MIN, WEEK_DAY_HEIGHT - top), MIN_BLOCK_PX)

  const widthPct = 100 / lanes
  const style = {
    top: isReminder ? Math.max(top - REMINDER_PX, 0) : top,
    height,
    left: `calc(${lane * widthPct}% + 1px)`,
    width: `calc(${widthPct}% - 2px)`,
    zIndex: 1 + lane,
    borderColor: color,
    ...(isReminder
      ? { background: 'var(--color-surface)', color: 'var(--color-text)', borderLeft: `3px solid ${color}` }
      : {
          background: isSleep
            ? `repeating-linear-gradient(45deg, ${color}3d, ${color}3d 6px, transparent 6px, transparent 14px)`
            : status === 'ghost'
              ? 'transparent'
              : color,
          color: isSleep ? 'var(--color-text)' : status === 'ghost' ? 'var(--color-text-muted)' : contrastTextColor(color),
        }),
  }

  const open = (e) => {
    e.stopPropagation()
    openModal('itemDetail', { itemId: item.id, instanceId: instance.id, date, time: instance.time })
  }
  const toggle = (e) => {
    e.stopPropagation()
    markInstanceComplete(instance.id)
  }

  return (
    <div
      className={`week-block status-${status}${isReminder ? ' week-block-reminder' : ''}`}
      data-item-id={instance.itemId}
      style={style}
      onClick={open}
      title={`${item.title}${instance.time ? ` · ${formatTimeLabel(instance.time)}` : ''}`}
    >
      <button type="button" className="week-block-check" onClick={toggle} aria-label="Mark complete">
        <StatusCircle status={status} size={12} />
      </button>
      <span className="week-block-title">{item.title}</span>
      {signedIn && item.syncEnabled && height > 30 && <span className="week-block-sync">☁</span>}
      {height > 40 && overflowMinutes == null && <span className="week-block-time">{formatTimeLabel(instance.time)}</span>}
    </div>
  )
}

function WeekColumn({ date, instances, previousInstances, items, categories, hideSynced }) {
  const openModal = useAppStore((s) => s.openModal)
  const colRef = useRef(null)

  const entries = useMemo(() => {
    const itemById = new Map(items.map((i) => [i.id, i]))
    const out = []
    for (const inst of instances) {
      if (inst.isAllDay || !inst.time) continue
      const item = itemById.get(inst.itemId)
      if (!item || (hideSynced && item.syncEnabled)) continue
      out.push({ key: inst.id, instance: inst, item, overflowMinutes: null })
    }
    // Yesterday's overnight items (e.g. sleep) continue at the top of today.
    for (const inst of previousInstances) {
      if (inst.isAllDay || !inst.time) continue
      const item = itemById.get(inst.itemId)
      if (!item || (hideSynced && item.syncEnabled)) continue
      const duration = inst.durationMinutes ?? item.durationMinutes ?? null
      if (duration == null) continue
      const overflow = timeStrToMinutes(inst.time) + duration - 1440
      if (overflow > 0) out.push({ key: `cont-${inst.id}`, instance: inst, item, overflowMinutes: overflow, originalDate: addDaysStr(date, -1) })
    }
    return out
  }, [instances, previousInstances, items, hideSynced, date])

  const lanes = useMemo(
    () =>
      computeLanes(
        entries.map((e) => {
          const duration = e.instance.durationMinutes ?? e.item.durationMinutes ?? null
          const start = e.overflowMinutes != null ? 0 : timeStrToMinutes(e.instance.time)
          const len = e.overflowMinutes ?? duration ?? 0
          // A reminder is a thin line; give it a small slot so it doesn't stack.
          return { id: e.key, start, end: start + Math.max(len, 20) }
        }),
      ),
    [entries],
  )

  const handleClick = (e) => {
    if (e.target.closest('.week-block')) return
    const y = e.clientY - colRef.current.getBoundingClientRect().top
    const minutes = Math.floor(Math.max(0, y) / PX_PER_MIN / 30) * 30
    openModal('itemDetail', { itemId: null, date, time: minutesToTimeStr(minutes) })
  }

  return (
    <div
      ref={colRef}
      className={`week-col${isTodayStr(date) ? ' week-col-today' : ''}`}
      style={{ height: WEEK_DAY_HEIGHT }}
      onClick={handleClick}
    >
      {HOURS.map((h) => (
        <div key={h} className="week-hour-cell" style={{ height: WEEK_HOUR_HEIGHT }} />
      ))}
      {isTodayStr(date) && (
        <div className="week-now">
          <CurrentTimeIndicator />
        </div>
      )}
      {entries.map((e) => {
        const l = lanes.get(e.key) ?? { lane: 0, lanes: 1 }
        const category = categories.find((c) => c.id === e.item.categoryId)
        return (
          <WeekBlock
            key={e.key}
            instance={e.instance}
            item={e.item}
            category={category}
            date={e.originalDate ?? date}
            lane={l.lane}
            lanes={l.lanes}
            overflowMinutes={e.overflowMinutes}
          />
        )
      })}
    </div>
  )
}

export function WeekView() {
  const { date: dateParam } = useParams()
  const date = dateParam || todayStr()
  const navigate = usePaneNavigate()
  const splitOpen = useAppStore((s) => s.splitOpen)
  const canShowWeek = useCanShowWeek() && !splitOpen
  const scrollRef = useRef(null)
  const openModal = useAppStore((s) => s.openModal)
  const setCurrentDate = useAppStore((s) => s.setCurrentDate)
  const journalOpen = useAppStore((s) => s.journalOpen)
  const instancesByDate = useEntityStore((s) => s.instancesByDate)
  const loadInstancesForDate = useEntityStore((s) => s.loadInstancesForDate)
  const items = useEntityStore((s) => s.items)
  const categories = useEntityStore((s) => s.categories)
  const hideSynced = useAuthStore((s) => Boolean(s.user) && s.needsUnlock)

  // The week is the 7 days starting on the selected date (not a calendar week).
  const weekStart = date
  const days = useMemo(() => Array.from({ length: 7 }, (_, i) => addDaysStr(weekStart, i)), [weekStart])

  // The week plus the day before it (for an overnight item running into Sunday).
  useEffect(() => {
    for (const d of [addDaysStr(weekStart, -1), ...days]) loadInstancesForDate(d)
  }, [weekStart, days, loadInstancesForDate])

  useEffect(() => {
    setCurrentDate(date)
  }, [date, setCurrentDate])

  // Start the scroll near the start of the waking day (or just before now, on
  // the current week). Mount-only so paging between weeks keeps your place.
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const hour = days.includes(todayStr()) ? Math.max(new Date().getHours() - 1, 0) : 7
    el.scrollTop = hour * WEEK_HOUR_HEIGHT
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // A narrow window / portrait phone can't fit seven columns: fall back to the day.
  useEffect(() => {
    if (!canShowWeek) navigate(`/day/${date}`, { replace: true })
  }, [canShowWeek, date, navigate])

  if (!canShowWeek) return null

  return (
    <div className="day-view week-view">
      <TopBar date={date} mode="week" />
      <div className="week-head">
        <div className="week-gutter" />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            className={`week-head-cell${isTodayStr(d) ? ' week-head-today' : ''}`}
            onClick={() => navigate(`/day/${d}`)}
            title="Open this day"
          >
            <span className="week-head-dow">{format(fromDateStr(d), 'EEE')}</span>
            <span className="week-head-num">{format(fromDateStr(d), 'd')}</span>
          </button>
        ))}
      </div>
      <div className="week-allday">
        <div className="week-gutter" />
        {days.map((d) => (
          <div key={d} className="week-allday-cell">
            <AllDayRow instances={instancesByDate[d] ?? []} date={d} />
          </div>
        ))}
      </div>
      <div className="week-scroll" ref={scrollRef}>
        <div className="week-body">
          <div className="week-gutter week-hours">
            {HOURS.map((h) => (
              <div key={h} className="week-hour-label" style={{ height: WEEK_HOUR_HEIGHT }}>
                {h === 0 ? '' : formatTimeLabel(`${String(h).padStart(2, '0')}:00`)}
              </div>
            ))}
          </div>
          {days.map((d) => (
            <WeekColumn
              key={d}
              date={d}
              instances={instancesByDate[d] ?? []}
              previousInstances={instancesByDate[addDaysStr(d, -1)] ?? []}
              items={items}
              categories={categories}
              hideSynced={hideSynced}
            />
          ))}
        </div>
      </div>
      {!journalOpen && (
        <button className="fab" onClick={() => openModal('quickAdd', { date })} aria-label="Quick add item">
          <Icon name="plus" size={24} />
        </button>
      )}
    </div>
  )
}
