import { useMemo } from 'react'
import { useEntityStore } from '../store/useEntityStore.js'

export function useItem(itemId) {
  return useEntityStore((s) => s.items.find((i) => i.id === itemId) ?? null)
}

// The item as shown for one specific occurrence: a recurring instance can
// carry its own title/category (edited with "Save" rather than "Save for
// all"), which take precedence over the series' values for that day only.
export function applyInstanceOverrides(item, instance) {
  if (!item || !instance) return item
  const hasTitle = instance.titleOverride != null
  const hasCategory = instance.categoryIdOverride !== undefined
  // undefined = inherit the series' location; null = this day has none.
  const hasLocation = instance.locationOverride !== undefined
  if (!hasTitle && !hasCategory && !hasLocation) return item
  return {
    ...item,
    ...(hasTitle ? { title: instance.titleOverride } : {}),
    ...(hasCategory ? { categoryId: instance.categoryIdOverride } : {}),
    ...(hasLocation ? { location: instance.locationOverride } : {}),
  }
}

export function useInstanceItem(instance) {
  const item = useItem(instance.itemId)
  return useMemo(
    () => applyInstanceOverrides(item, instance),
    [item, instance.titleOverride, instance.categoryIdOverride, instance.locationOverride]
  )
}
