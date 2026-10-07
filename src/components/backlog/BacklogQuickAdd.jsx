import { useState } from 'react'
import { useEntityStore } from '../../store/useEntityStore.js'

const DEFAULT_DURATION_MINUTES = 30

// Type a task and press Enter — it lands at the top of the list (highest
// priority), where it can be dragged down if it isn't.
export function BacklogQuickAdd() {
  const createItem = useEntityStore((s) => s.createItem)
  const [title, setTitle] = useState('')
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const trimmed = title.trim()
    if (!trimmed) return
    setTitle('')
    setError('')
    try {
      await createItem({
        title: trimmed,
        durationMinutes: DEFAULT_DURATION_MINUTES,
        categoryId: null,
        isAllDay: false,
        isUnscheduled: true,
      })
    } catch (err) {
      setTitle(trimmed)
      setError(err instanceof Error ? err.message : 'Could not add that task')
    }
  }

  return (
    <form className="backlog-quick-add" onSubmit={submit}>
      <input
        type="text"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Add a task…"
        aria-label="Add a task"
      />
      {error && <span className="form-error">{error}</span>}
    </form>
  )
}
