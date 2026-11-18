import { useEffect, useRef } from 'react'

// Modals can stack (e.g. a "new group" dialog over the item form). Escape and
// the browser/phone Back button should only close the topmost one, so mounted
// modals register here.
const openModals = []

// The listener stays attached for the app's lifetime so a pending programmatic
// back() is always consumed by ignoredPops, even after the last modal closes.
// Back-button support: each open modal pushes one history entry. Back pops it
// (popstate) and closes the topmost modal instead of leaving the page. When a
// modal closes by other means we pop its entry ourselves; that programmatic
// back() fires a popstate we must ignore.
let modalIdCounter = 0
let ignoredPops = 0

function onPopState() {
  if (ignoredPops > 0) {
    ignoredPops--
    return
  }
  const top = openModals[openModals.length - 1]
  if (top) {
    top.popped = true
    top.close()
  }
}

if (typeof window !== 'undefined') window.addEventListener('popstate', onPopState)

// headerAction (optional): when given, the close button moves to the left of
// the title and this node takes the top-right slot (e.g. a Save button).
export function Modal({ title, onClose, children, footer, headerAction, width = 480 }) {
  // Keep the latest onClose without re-running the effect (callers pass inline
  // lambdas; re-running would push a new history entry every render).
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    const token = { id: ++modalIdCounter, popped: false, close: () => onCloseRef.current() }
    openModals.push(token)
    // Spread the existing state so react-router's bookkeeping (key/idx) survives.
    window.history.pushState({ ...window.history.state, __modal: token.id }, '')

    const onKeyDown = (e) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === token) onCloseRef.current()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const i = openModals.indexOf(token)
      if (i !== -1) openModals.splice(i, 1)
      // Closed via X/Escape/save rather than Back: drop our history entry — but
      // only if we're still on it (a modal that navigated has moved on).
      if (!token.popped && window.history.state?.__modal === token.id) {
        ignoredPops++
        window.history.back()
      }
    }
  }, [])

  return (
    <div className="modal-overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal-card" style={{ maxWidth: width }} role="dialog" aria-modal="true">
        <div className="modal-header">
          {headerAction && (
            <button className="icon-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
          <h2 className={headerAction ? 'modal-title-centered' : undefined}>{title}</h2>
          {headerAction ?? (
            <button className="icon-button" onClick={onClose} aria-label="Close">
              ✕
            </button>
          )}
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  )
}
