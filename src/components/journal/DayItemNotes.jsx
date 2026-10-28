import { useInstancesForDate } from '../../hooks/useInstancesForDate.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { ToggleButton } from '../shared/ToggleButton.jsx'
import { isRichTextEmpty } from '../../utils/richText.js'

/** Read-only rollup of each scheduled item's own notes for the day, shown
 * under the journal so a day's context (task notes) sits alongside the
 * free-form entry — editing still happens in the item's own modal. Notes
 * live on the instance (independent per occurrence), so this reads
 * instance.notes rather than the item template's notes. Each note can be
 * toggled out of the journal; an excluded note stays listed (collapsed) so it
 * can be toggled back in. */
export function DayItemNotes({ date }) {
  const instances = useInstancesForDate(date)
  const items = useEntityStore((s) => s.items)
  const setExcluded = useEntityStore((s) => s.setInstanceJournalExcluded)

  const entries = instances
    .map((instance) => ({ instance, item: items.find((i) => i.id === instance.itemId) }))
    .filter(({ item, instance }) => item && !isRichTextEmpty(instance.notes))

  if (entries.length === 0) return null

  return (
    <div className="day-item-notes">
      {entries.map(({ instance, item }) => (
        <div key={instance.id} className={`day-item-note ${instance.journalExcluded ? 'excluded' : ''}`}>
          <div className="day-item-note-header">
            <div className="day-item-note-title">{item.title}</div>
            <ToggleButton pressed={!instance.journalExcluded} onChange={(on) => setExcluded(instance.id, !on)}>
              In journal
            </ToggleButton>
          </div>
          {!instance.journalExcluded && (
            <div className="day-item-note-body" dangerouslySetInnerHTML={{ __html: instance.notes }} />
          )}
        </div>
      ))}
    </div>
  )
}
