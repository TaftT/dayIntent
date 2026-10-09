// The complete / in-progress / not-done marker on day-view tasks. Drawn with
// CSS and SVG instead of the "○ ◐ ✓" text characters it used before: those
// aren't in the app font, so each device substituted whatever symbol font it
// had and they rendered at wildly different sizes (big on desktop, small on
// phones). This is the same size everywhere and takes the surrounding text
// color, so it works on any category color.
export function StatusCircle({ status, size = 20 }) {
  const half = status === 'worked_on' || status === 'in_progress'
  const done = status === 'completed'
  return (
    <span
      className={`status-circle${half ? ' status-circle-half' : ''}`}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      {done && (
        <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3.5 8.5l3 3 6-7" />
        </svg>
      )}
    </span>
  )
}
