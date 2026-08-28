import { useEffect, useRef, useState } from 'react'
import { RichTextEditor } from '../shared/RichTextEditor.jsx'
import { SleepScheduleControl } from './SleepScheduleControl.jsx'
import { MoodSelector } from './MoodSelector.jsx'
import { ScreenTimeControl } from './ScreenTimeControl.jsx'
import { DayItemNotes } from './DayItemNotes.jsx'
import { useJournal } from '../../hooks/useJournal.js'
import { useAppStore } from '../../store/useAppStore.js'
import { formatDayHeading } from '../../utils/dateUtils.js'

export function JournalPanel({ date }) {
  const { journal, save, saveMood, saveSpouseMood, saveScreenTime } = useJournal(date)
  const toggleJournal = useAppStore((s) => s.toggleJournal)
  const [content, setContent] = useState(journal?.content ?? '')
  const saveTimeout = useRef(null)

  useEffect(() => {
    setContent(journal?.content ?? '')
  }, [date, journal?.content])

  const handleChange = (html) => {
    setContent(html)
    clearTimeout(saveTimeout.current)
    saveTimeout.current = setTimeout(() => save(html), 500)
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
        <MoodSelector mood={journal?.mood ?? null} onChange={saveMood} label="My mood" />
        <MoodSelector mood={journal?.spouseMood ?? null} onChange={saveSpouseMood} label="Spouse mood" />
        <ScreenTimeControl minutes={journal?.screenTimeMinutes ?? null} onChange={saveScreenTime} />
        <SleepScheduleControl date={date} />
        <DayItemNotes date={date} />
        <RichTextEditor value={content} onChange={handleChange} className="journal-editor" />
      </div>
    </div>
  )
}
