// Small inline-SVG icon set so the nav and toolbar don't lean on emoji
// (which render inconsistently across platforms). Every icon is a 24x24
// stroke drawing that inherits the current text color, so callers just size
// it and set `color` like any other glyph.

const PATHS = {
  // Bottom nav
  day: (
    <>
      <rect x="3" y="4" width="18" height="17" rx="2" />
      <path d="M3 9h18M8 2v4M16 2v4" />
      <path d="M8 14h4" />
    </>
  ),
  backlog: (
    <>
      <path d="M8 6h12M8 12h12M8 18h12" />
      <circle cx="4" cy="6" r="1.4" />
      <circle cx="4" cy="12" r="1.4" />
      <circle cx="4" cy="18" r="1.4" />
    </>
  ),
  stats: (
    <>
      <path d="M4 20h16" />
      <rect x="6" y="12" width="3.4" height="6" rx="0.6" />
      <rect x="12" y="8" width="3.4" height="10" rx="0.6" />
      <rect x="17.2" y="4" width="3.4" height="14" rx="0.6" />
    </>
  ),
  // Toolbar
  journal: (
    <>
      <path d="M5 3.5h11a2 2 0 0 1 2 2V21l-2.2-1.4L13.6 21 11.4 19.6 9.2 21 7 19.6 5 21z" />
      <path d="M8 8h7M8 12h7" />
    </>
  ),
  search: (
    <>
      <circle cx="11" cy="11" r="6" />
      <path d="M20 20l-4.3-4.3" />
    </>
  ),
  categories: (
    <>
      <path d="M20.6 13.4 13.4 20.6a2 2 0 0 1-2.8 0l-7.2-7.2a2 2 0 0 1-.6-1.4V4.5A1.5 1.5 0 0 1 4.3 3h7.5a2 2 0 0 1 1.4.6l7.4 7.4a2 2 0 0 1 0 2.4z" />
      <circle cx="7.5" cy="7.5" r="1.5" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
}

export function Icon({ name, size = 20, className, ...props }) {
  const path = PATHS[name]
  if (!path) return null
  return (
    <svg
      className={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {path}
    </svg>
  )
}
