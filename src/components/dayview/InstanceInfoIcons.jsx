import { isRichTextEmpty } from '../../utils/richText.js'
import { useEntityStore } from '../../store/useEntityStore.js'

// Small at-a-glance markers on a day-view item: where it is, whether it has
// notes, and which backlog group it belongs to. Each shows only when it applies.
export function InstanceInfoIcons({ item, instance }) {
  const group = useEntityStore((s) => (item?.groupId ? s.groups.find((g) => g.id === item.groupId) : null))
  const location = item?.location
  const hasNotes = !isRichTextEmpty(instance?.notes)
  return (
    <>
      {location && (
        <span className="instance-info-icon" title={location.label || 'Has a location'} aria-label="Has a location">
          📍
        </span>
      )}
      {hasNotes && (
        <span className="instance-info-icon" title="Has notes" aria-label="Has notes">
          📝
        </span>
      )}
      {group && (
        <span className="instance-info-icon" title={`Group: ${group.name}`} aria-label={`Group: ${group.name}`}>
          🗂️
        </span>
      )}
    </>
  )
}
