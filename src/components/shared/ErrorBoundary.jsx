import { Component } from 'react'

/** Last-resort screen so a rendering crash never leaves a blank white page. */
export class ErrorBoundary extends Component {
  state = { error: null }

  static getDerivedStateFromError(error) {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return <CrashScreen error={this.state.error} />
  }
}

export function CrashScreen({ error, title = 'Something went wrong' }) {
  return (
    <div className="crash-screen" role="alert">
      <h1>{title}</h1>
      <p>
        Your plans are stored on this device and haven’t been touched. Reloading usually fixes this; if it keeps
        happening, try closing other DayIntent tabs.
      </p>
      <button type="button" className="crash-reload" onClick={() => window.location.reload()}>
        Reload
      </button>
      {error?.message && <pre className="crash-detail">{String(error.message)}</pre>}
    </div>
  )
}
