import { useEffect } from 'react'

// headerAction (optional): when given, the close button moves to the left of
// the title and this node takes the top-right slot (e.g. a Save button).
export function Modal({ title, onClose, children, footer, headerAction, width = 480 }) {
  useEffect(() => {
    const onKeyDown = (e) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
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
