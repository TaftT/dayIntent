import { useAppStore } from '../../store/useAppStore.js'
import { useEntityStore } from '../../store/useEntityStore.js'

// Reminders are easy to miss if they auto-dismiss — they stay on screen
// until the user explicitly dismisses one or marks its task complete.
function Toast({ toast }) {
  const removeToast = useAppStore((s) => s.removeToast)
  const markInstanceComplete = useEntityStore((s) => s.markInstanceComplete)

  return (
    <div className={`toast toast-${toast.kind}`}>
      <span className="toast-icon">{toast.kind === 'finish' ? '⏱' : toast.kind === 'start' ? '▶' : '⏳'}</span>
      <span className="toast-message">{toast.message}</span>
      {toast.instanceId && toast.kind === 'finish' && (
        <button
          type="button"
          className="btn btn-subtle toast-action"
          onClick={() => {
            markInstanceComplete(toast.instanceId)
            removeToast(toast.id)
          }}
        >
          Mark complete
        </button>
      )}
      <button type="button" className="icon-button toast-dismiss" onClick={() => removeToast(toast.id)} aria-label="Dismiss">
        ✕
      </button>
    </div>
  )
}

export function ToastContainer() {
  const toasts = useAppStore((s) => s.toasts)
  if (toasts.length === 0) return null

  return (
    <div className="toast-container">
      {toasts.map((toast) => (
        <Toast key={toast.id} toast={toast} />
      ))}
    </div>
  )
}
