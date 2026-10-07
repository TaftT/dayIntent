import { useEffect } from 'react'

// Modals can stack (e.g. a "new group" dialog over the item form). Escape
// should only close the topmost one, so mounted modals register here.
const openModals = []

// headerAction (optional): when given, the close button moves to the left of
// the title and this node takes the top-right slot (e.g. a Save button).
export function Modal({ title, onClose, children, footer, headerAction, width = 480 }) {
  useEffect(() => {
    const token = {}
    openModals.push(token)
    const onKeyDown = (e) => {
      if (e.key === 'Escape' && openModals[openModals.length - 1] === token) onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
      const i = openModals.indexOf(token)
      if (i !== -1) openModals.splice(i, 1)
    }
  }, [onClose])

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
