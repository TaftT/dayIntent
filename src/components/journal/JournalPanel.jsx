import { useEffect, useRef, useState } from 'react'
import { RichTextEditor } from '../shared/RichTextEditor.jsx'
import { SleepScheduleControl } from './SleepScheduleControl.jsx'
import { MoodTally } from './MoodTally.jsx'
import { ScreenTimeControl } from './ScreenTimeControl.jsx'
import { DayItemNotes } from './DayItemNotes.jsx'
import { useJournal } from '../../hooks/useJournal.js'
import { useAppStore } from '../../store/useAppStore.js'
import { formatDayHeading } from '../../utils/dateUtils.js'

export function JournalPanel({ date }) {
  const { journal, save, saveScreenTime } = useJournal(date)
  const toggleJournal = useAppStore((s) => s.toggleJournal)
  const [content, setContent] = useState(journal?.content ?? '')
  const saveTimeout = useRef(null)

  const lastTyped = useRef(null) // latest HTML typed here, so our own save echoing back is ignored
  const pending = useRef(false) // typed since the last save started

  // A reset to the stored text moves the caret to the end, so only do it when
  // the day changes or the text changed elsewhere — never for our own saves
  // or while there are unsaved edits.
  useEffect(() => {
    lastTyped.current = null
    pending.current = false
  }, [date])

  useEffect(() => {
    if (pending.current) return
    const stored = journal?.content ?? ''
    if (lastTyped.current !== null && stored === lastTyped.current) return
    lastTyped.current = null
    setContent(stored)
  }, [date, journal?.content])

  const handleChange = (html) => {
    setContent(html)
    lastTyped.current = html
    pending.current = true
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(async () => {
      pending.current = false
      await save(html)
    }, 500)
  }

  return (
    <div className="journal-panel">
      <div className="journal-panel-header">
        <h3>Journal — {formatDayHeading(date)}</h3>
        <button className="icon-button" onClick={toggleJournal} aria-label="Close journal">
          ✕
        </button>
      </div>
      <div className="journal-panel-scroll">
        <MoodTally date={date} journal={journal} />
        <ScreenTimeControl minutes={journal?.screenTimeMinutes ?? null} onChange={saveScreenTime} />
        <SleepScheduleControl date={date} />
        <DayItemNotes date={date} />
        <RichTextEditor value={content} onChange={handleChange} className="journal-editor" />
      </div>
    </div>
  )
}
