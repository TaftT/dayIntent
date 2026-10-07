import { useRef, useState } from 'react'

// Small "i" button that reveals explanatory text on click (works on touch,
// unlike a hover-only tooltip). The text is positioned against the nearest
// positioned ancestor (the form) and spans its width just below the button,
// so it can never push the modal wider than the screen.
export function InfoTip({ children, label = 'More info' }) {
  const [open, setOpen] = useState(false)
  const btnRef = useRef(null)
  const top = btnRef.current ? btnRef.current.offsetTop + btnRef.current.offsetHeight + 6 : 0
  return (
    <span className="info-tip">
      <button
        ref={btnRef}
        type="button"
        className="info-tip-btn"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        i
      </button>
      {open && (
        <span className="info-tip-text" role="note" style={{ top }}>
          {children}
        </span>
      )}
    </span>
  )
}
