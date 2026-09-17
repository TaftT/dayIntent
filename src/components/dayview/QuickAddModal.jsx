import { useState } from 'react'
import { Modal } from '../shared/Modal.jsx'
import { Button } from '../shared/Button.jsx'
import { useEntityStore } from '../../store/useEntityStore.js'
import { useAppStore } from '../../store/useAppStore.js'
import {
  roundToTenMinutes,
  minutesToTimeStr,
  formatTimeLabel,
  formatDayHeading,
} from '../../utils/dateUtils.js'

const DEFAULT_DURATION_MINUTES = 30

// Start time defaults to the 10-minute marker closest to the current clock,
// so a thing added "now" lands where you'd expect on the grid.
function nearestTenMinNow() {
  const now = new Date()
  return minutesToTimeStr(roundToTenMinutes(now.getHours() * 60 + now.getMinutes()))
}

export function QuickAddModal({ date }) {
  const closeModal = useAppStore((s) => s.closeModal)
  const openModal = useAppStore((s) => s.openModal)
  const createItem = useEntityStore((s) => s.createItem)
  const scheduleItemOnDate = useEntityStore((s) => s.scheduleItemOnDate)

  const [title, setTitle] = useState('')
  const [time] = useState(nearestTenMinNow)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  const handleAdd = async () => {
    if (!title.trim()) {
      setError('Title is required')
      return
    }
    setSaving(true)
    try {
      const saved = await createItem({
        title: title.trim(),
        durationMinutes: DEFAULT_DURATION_MINUTES,
        categoryId: null,
        isAllDay: false,
        isUnscheduled: true,
      })
      await scheduleItemOnDate(saved.id, date, { time, isAllDay: false })
      closeModal()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong adding this item')
      setSaving(false)
    }
  }

  // Hand off to the full editor, carrying the title and the same defaults
  // this quick-add would have used.
  const handleMoreOptions = () => {
    openModal('itemDetail', { itemId: null, date, time, initialTitle: title.trim() })
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
        Add
      </Button>
    </>
  )

  return (
    <Modal title="Quick add" onClose={closeModal} footer={footer} width={380}>
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
        {error && <div className="form-error">{error}</div>}
        <p className="quick-add-hint">
          {formatDayHeading(date)} at {formatTimeLabel(time)} · {DEFAULT_DURATION_MINUTES} min
        </p>
      </div>
    </Modal>
  )
}
