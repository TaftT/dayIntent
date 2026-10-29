import { useEffect, useRef, useState } from 'react'
import { RichTextEditor } from '../shared/RichTextEditor.jsx'
import { useJournal } from '../../hooks/useJournal.js'

// Inline editor for one day's journal text, used on the Journal page so
// today's entry can be written without leaving the page. Saves shortly after
// typing stops, and flushes on unmount so leaving mid-edit loses nothing.
export function EntryEditor({ date, placeholder }) {
  const { journal, save } = useJournal(date)
  const [content, setContent] = useState(journal?.content ?? '')
  const timer = useRef(null)
  const pending = useRef(null) // latest unsaved HTML, or null when nothing is waiting
  const lastTyped = useRef(null) // latest HTML this editor produced
  const saveRef = useRef(save)
  saveRef.current = save

  // Pick up the stored text when it loads (or changes elsewhere), but never
  // while there are unsaved edits — that would overwrite what's being typed.
  // Echoes of our own saves are ignored too: re-assigning the editor's HTML
  // (even when it differs only by normalisation, or is a save or two behind)
  // resets the caret, which showed up as jumping to the end while typing.
  useEffect(() => {
    if (pending.current !== null) return
    const stored = journal?.content ?? ''
    if (lastTyped.current !== null && stored === lastTyped.current) return
    lastTyped.current = null
    setContent(stored)
  }, [journal?.content])

  const handleChange = (html) => {
    setContent(html)
    lastTyped.current = html
    pending.current = html
    clearTimeout(timer.current)
    timer.current = setTimeout(async () => {
      const toSave = pending.current
      if (toSave === null) return
      await saveRef.current(toSave)
      // Only settle if nothing newer was typed while saving.
      if (pending.current === toSave) pending.current = null
    }, 500)
  }

  useEffect(
    () => () => {
      clearTimeout(timer.current)
      if (pending.current !== null) saveRef.current(pending.current)
    },
    [],
  )

  return <RichTextEditor value={content} onChange={handleChange} className="journal-editor" placeholder={placeholder} />
}
