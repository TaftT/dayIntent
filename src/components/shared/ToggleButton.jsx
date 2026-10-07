export function ToggleButton({ pressed, onChange, children }) {
  return (
    <button
      type="button"
      className={`toggle-btn${pressed ? ' toggle-btn-on' : ''}`}
      aria-pressed={pressed}
      onClick={() => onChange(!pressed)}
    >
      {children}
    </button>
  )
}
