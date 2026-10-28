import { createContext, useContext } from 'react'
import { useNavigate } from 'react-router-dom'

// Present only while the desktop split view is on. Each pane gets its own
// `navigate`, so a page rendered in the right-hand pane changes that pane's
// route instead of the browser URL (which belongs to the left pane).
export const PaneContext = createContext(null)

export function usePane() {
  return useContext(PaneContext)
}

/** Drop-in for react-router's useNavigate that respects which pane it's in. */
export function usePaneNavigate() {
  const routerNavigate = useNavigate()
  const pane = useContext(PaneContext)
  return pane ? pane.navigate : routerNavigate
}
