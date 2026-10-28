import { useEffect, useState } from 'react'

export const SPLIT_MIN_WIDTH = 900

/** True on desktop-width windows, where the split view is available. */
export function useIsWide() {
  const query = `(min-width: ${SPLIT_MIN_WIDTH}px)`
  const [wide, setWide] = useState(() => window.matchMedia(query).matches)
  useEffect(() => {
    const mql = window.matchMedia(query)
    const onChange = (e) => setWide(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [query])
  return wide
}
