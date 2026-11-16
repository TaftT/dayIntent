import { useEffect, useState } from 'react'

export const SPLIT_MIN_WIDTH = 900

// Desktop-width windows, or a phone held sideways (landscape, short but
// still wide enough for seven columns).
export const WEEK_VIEW_QUERY = `(min-width: ${SPLIT_MIN_WIDTH}px), (orientation: landscape) and (max-height: 600px) and (min-width: 560px)`

/** True where the week view fits: desktop windows and landscape phones. */
export function useCanShowWeek() {
  const [ok, setOk] = useState(() => window.matchMedia(WEEK_VIEW_QUERY).matches)
  useEffect(() => {
    const mql = window.matchMedia(WEEK_VIEW_QUERY)
    const onChange = (e) => setOk(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return ok
}

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
