import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { CategoryPicker } from '../itemdetail/CategoryPicker.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import {
  roundToTenMinutes,
  minutesToTimeStr,
  formatTimeLabel,
  formatDayHeading,
} from '../../utils/dateUtils.js'

const DEFAULT_DURATION_MINUTES = 30
const STEP_MINUTES = 10
const LAST_END_MINUTE = 23 * 60 + 50

// The "+" button logs something you just finished: it ends at the 10-minute
// marker closest to now and runs back by the chosen duration, so a 30-minute
// item finished at 2:28 reads 2:00–2:30. Captured once on open so the times
// don't shift while you're typing.
function nearestTenMinNow() {
  const now = new Date()
  return Math.min(roundToTenMinutes(now.getHours() * 60 + now.getMinutes()), LAST_END_MINUTE)
}

export function QuickAddModal({ date }) {
  const closeModal = useAppStore((s) => s.closeModal)
  const openModal = useAppStore((s) => s.openModal)
  const createItem = useEntityStore((s) => s.createItem)
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)
  const setInstancePercentComplete = useEntityStore((s) => s.setInstancePercentComplete)

  const [title, setTitle] = useState('')
  const [categoryId, setCategoryId] = useState(null)
  const [duration, setDuration] = useState(DEFAULT_DURATION_MINUTES)
  const [endMinutes] = useState(nearestTenMinNow)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Can't start before midnight, so a long duration late-night-clamps to what fits.
  const effectiveDuration = Math.min(duration, endMinutes) || STEP_MINUTES
  const startMinutes = endMinutes - effectiveDuration
  const startTime = minutesToTimeStr(startMinutes)
  const endTime = minutesToTimeStr(endMinutes)

  const changeDuration = (delta) => setDuration((d) => Math.max(STEP_MINUTES, d + delta))

  const handleAdd = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    try {
      const saved = await createItem({
        title: title.trim(),
        durationMinutes: effectiveDuration,
        categoryId,
        isAllDay: false,
        isUnscheduled: true,
      })
      const instance = await scheduleItemOnDate(saved.id, date, { time: startTime, isAllDay: false })
      // The end is rounded to the nearest marker, which can sit a minute or
      // two ahead of the clock — mark it done explicitly rather than relying on
      // the "already elapsed" check.
      await setInstancePercentComplete(instance.id, 100)
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong adding this item')
      setSaving(false)
    }
  }

  // Hand off to the full editor with what's been filled in, as a normal
  // (not-yet-complete) item. Unlike "Log it", the start is the current time
  // (nearest 10 minutes), not backed off by the duration.
  const handleMoreOptions = () => {
    openModal('itemDetail', {
      itemId: null,
      date,
      time: endTime,
      initialTitle: title.trim(),
      initialCategoryId: categoryId,
      initialDuration: effectiveDuration,
    })
  }

  const footer = (
    <>
      <Button variant="subtle" onClick={handleMoreOptions}>
        More options
      </Button>
      <Button variant="subtle" onClick={closeModal}>
        Cancel
      </Button>
      <Button variant="primary" onClick={handleAdd} disabled={saving}>
        Log it
      </Button>
    </>
  )

  return (
    <Modal title="Log what you just did" onClose={closeModal} footer={footer} width={380}>
      <div className="quick-add-form">
        <input
          type="text"
          className="title-input"
          placeholder="Title"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleAdd()
          }}
          autoFocus
        />
        <CategoryPicker categoryId={categoryId} onChange={setCategoryId} />
        <div className="quick-add-duration">
          <span>Duration</span>
          <button type="button" className="icon-button" onClick={() => changeDuration(-STEP_MINUTES)} aria-label="Shorter">
            −
          </button>
          <span className="quick-add-duration-value">{effectiveDuration} min</span>
          <button type="button" className="icon-button" onClick={() => changeDuration(STEP_MINUTES)} aria-label="Longer">
            +
          </button>
        </div>
        {error && <div className="form-error">{error}</div>}
        <p className="quick-add-hint">
          {formatDayHeading(date)} · {formatTimeLabel(startTime)} – {formatTimeLabel(endTime)} · marked complete
        </p>
      </div>
    </Modal>
  )
}
