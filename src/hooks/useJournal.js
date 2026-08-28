import { useEffect } from 'react'
import { useEntityStore } from '../store/useEntityStore.js'

export function useJournal(date) {
  const journal = useEntityStore((s) => s.journalsByDate[date])
  const loadJournalForDate = useEntityStore((s) => s.loadJournalForDate)
  const saveJournalForDate = useEntityStore((s) => s.saveJournalForDate)

  useEffect(() => {
    if (date) loadJournalForDate(date)
  }, [date, loadJournalForDate])

  return {
    journal: journal ?? null,
    save: (content) => saveJournalForDate(date, { content }),
    saveMood: (mood) => saveJournalForDate(date, { mood }),
    saveSpouseMood: (spouseMood) => saveJournalForDate(date, { spouseMood }),
    saveScreenTime: (screenTimeMinutes) => saveJournalForDate(date, { screenTimeMinutes }),
  }
}
