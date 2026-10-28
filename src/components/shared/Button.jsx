// `loading` disables the button and swaps in a spinner so a slow action can't
// be fired twice (e.g. a double-tapped Save creating duplicates).
export function Button({ variant = 'default', loading = false, disabled, children, ...props }) {
  return (
    <button className={`btn btn-${variant}`} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {loading && <span className="btn-spinner btn-spinner-inline" aria-hidden="true" />}
      {children}
    </button>
  )
}
