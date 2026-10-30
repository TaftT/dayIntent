import { useMemo, useRef } from 'react'
import { HourRow } from './HourRow.jsx'
import { InstanceBlock } from './InstanceBlock.jsx'
import { OvernightContinuationBlock } from './OvernightContinuationBlock.jsx'
import { CurrentTimeIndicator } from './CurrentTimeIndicator.jsx'
import { DAY_HEIGHT } from './gridConstants.js'
import { computeOverlapIndices } from './overlapLayout.js'
import { pxOffsetToTimeStr } from '../../utils/dnd/timeFromPointer.js'
import { isTodayStr, timeStrToMinutes } from '../../utils/dateUtils.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useHourlyWeather } from '../../hooks/useHourlyWeather.js'
import { hourLocationsForDay } from '../../weather/hourLocations.js'
import { locKey } from '../../weather/weatherSettings.js'
import { useWeatherStore } from '../../store/useWeatherStore.js'
import { useEntityStore } from '../../store/useEntityStore.js'

const HOURS = Array.from({ length: 24 }, (_, i) => i)

export function DayGrid({ instances, date, continuations = [] }) {
  const gridRef = useRef(null)
  const openModal = useAppStore((s) => s.openModal)
  const selectedInstanceIds = useAppStore((s) => s.selectedInstanceIds)
  const clearInstanceSelection = useAppStore((s) => s.clearInstanceSelection)
  const items = useEntityStore((s) => s.items)
  const allInstances = useEntityStore((s) => s.allInstances)
  const eventLocations = useMemo(
    () => hourLocationsForDay(date, instances, allInstances, items),
    [date, instances, allInstances, items],
  )
  const weatherByHour = useHourlyWeather(date, eventLocations)
  const weatherOn = useWeatherStore((s) => s.settings.enabled)

  // Where an event's location starts (its place) and ends (back to home) in the gutter.
  const sameLoc = (a, b) => (a ? locKey(a) : null) === (b ? locKey(b) : null)
  const placeMarkers = (hour) => {
    if (!weatherOn) return {}
    const cur = eventLocations[hour]
    const prev = hour > 0 ? eventLocations[hour - 1] : null
    return {
      startPlace: cur && !sameLoc(cur, prev) ? cur.label || 'Event location' : null,
      endPlace: prev && !cur ? 'Home' : null,
    }
  }

  const timedInstances = instances.filter((i) => !i.isAllDay)

  // Only sized blocks (a resolved duration) participate in the overlap
  // stagger — reminders render as thin lines, not blocks, so they never
  // need to be nudged aside.
  const blocks = timedInstances
    .map((i) => {
      const item = items.find((it) => it.id === i.itemId)
      const durationMinutes = i.durationMinutes ?? item?.durationMinutes ?? null
      if (durationMinutes == null || !i.time) return null
      const start = timeStrToMinutes(i.time)
      return { id: i.id, start, end: start + durationMinutes }
    })
    .filter(Boolean)
  const overlapIndexById = computeOverlapIndices(blocks)

  const handleGridClick = (e) => {
    if (e.target.closest('.instance-block')) return
    // Tapping empty space is the "escape" from a multi-select — dismiss it
    // rather than opening the new-item form on the same click.
    if (selectedInstanceIds.length > 0) {
      clearInstanceSelection()
      return
    }
    const rect = gridRef.current.getBoundingClientRect()
    const offsetY = e.clientY - rect.top
    const time = pxOffsetToTimeStr(offsetY)
    openModal('itemDetail', { itemId: null, date, time })
  }

  return (
    <div className="day-grid" ref={gridRef} style={{ height: DAY_HEIGHT }} onClick={handleGridClick}>
      {HOURS.map((hour) => (
        <HourRow
          key={hour}
          hour={hour}
          weather={weatherByHour.get(hour)}
          {...placeMarkers(hour)}
        />
      ))}
      {isTodayStr(date) && <CurrentTimeIndicator />}
      {continuations.map((c) => (
        <OvernightContinuationBlock key={`continuation-${c.id}`} continuation={c} />
      ))}
      {timedInstances.map((instance) => (
        <InstanceBlock
          key={instance.id}
          instance={instance}
          date={date}
          overlapIndex={overlapIndexById.get(instance.id) ?? 0}
        />
      ))}
    </div>
  )
}
