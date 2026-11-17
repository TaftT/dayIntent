import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useAppStore } from '../../store/useAppStore.js'
import { useEntityStore } from '../../store/useEntityStore.js'

/**
 * Carries out what the user did on a system notification (see public/
 * notification-sw.js): "Mark complete" completes that occurrence; tapping the
 * notification itself opens it on the calendar. The request arrives as a message
 * from the service worker when the app is already open, or as ?notif=… in the
 * URL when the notification had to launch it.
 */
export function NotificationActions() {
  const initialized = useEntityStore((s) => s.initialized)
  const markInstanceComplete = useEntityStore((s) => s.markInstanceComplete)
  const openModal = useAppStore((s) => s.openModal)
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    if (!initialized) return undefined

    const handle = async ({ action, instanceId, itemId, date, time }) => {
      if (!instanceId || !date) return
      navigate(`/day/${date}`, { replace: true })
      if (action === 'complete') {
        try {
          await markInstanceComplete(instanceId)
        } catch {
          // e.g. the item was deleted meanwhile; the day view still opened.
        }
      } else {
        openModal('itemDetail', { itemId, instanceId, date, time })
      }
    }

    // Launched by a notification.
    const params = new URLSearchParams(location.search)
    if (params.has('notif')) {
      handle({
        action: params.get('notif'),
        instanceId: params.get('instanceId'),
        itemId: params.get('itemId'),
        date: params.get('date'),
        time: params.get('time'),
      })
    }

    const onMessage = (e) => {
      if (e.data?.type === 'dayintent-notification') handle(e.data)
    }
    navigator.serviceWorker?.addEventListener('message', onMessage)
    return () => navigator.serviceWorker?.removeEventListener('message', onMessage)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized])

  return null
}
