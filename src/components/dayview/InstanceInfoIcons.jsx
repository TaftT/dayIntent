import { isRichTextEmpty } from '../../utils/richText.js'

// Small at-a-glance markers on a day-view item: where it is, whether it has
// notes, and which category it's in. Each shows only when it applies.
export function InstanceInfoIcons({ item, instance, category }) {
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
      {category && (
        <span className="instance-info-icon" title={`Category: ${category.name}`} aria-label={`Category: ${category.name}`}>
          🏷️
        </span>
      )}
    </>
  )
}
