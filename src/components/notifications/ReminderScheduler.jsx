import { useEffect, useRef, useState } from 'react'
import * as repo from '../../data/index.js'
import { useAppStore } from '../../store/useAppStore.js'
import { useEntityStore } from '../../store/useEntityStore.js'
import { playNotificationSound } from '../../utils/notificationSound.js'
import { notificationPermission, requestNotificationPermission, showSystemNotification } from '../../utils/systemNotify.js'
import { todayStr, timeStrToMinutes } from '../../utils/dateUtils.js'

const POLL_INTERVAL_MS = 20000
// If the scheduler only just started tracking a threshold that's already
// this many minutes in the past (e.g. the app was opened mid-day), treat it
// as already fired without popping a stale toast for something long over.
const FRESHNESS_WINDOW_MINUTES = 2
// Browsers throttle or freeze timers in background tabs, so a "start"/"finish"
// check can run several minutes late. Still worth telling the user then; only
// "starts in 10 minutes" goes stale quickly.
const LATE_WINDOW_MINUTES = 6
const DISMISS_KEY = 'dayintent.notifPromptDismissed'

function nowMinutes() {
  const now = new Date()
  return now.getHours() * 60 + now.getMinutes()
}

/**
 * Silent background poller (no visible UI of its own — see ToastContainer)
 * that watches today's scheduled instances and fires a toast + chime 10
 * minutes before start, at start, and at the scheduled finish time, so an
 * open task doesn't get forgotten. Runs regardless of which page is open.
 */
export function ReminderScheduler() {
  const addToast = useAppStore((s) => s.addToast)
  const firedRef = useRef(new Set())

  const [permission, setPermission] = useState(notificationPermission())
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  // The tab coming back to the foreground (or the app being reopened) is when
  // late reminders are caught up, and when a permission change is noticed.
  useEffect(() => {
    const onVisible = () => setPermission(notificationPermission())
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  const enable = async () => setPermission(await requestNotificationPermission())
  const dismiss = () => {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      /* fine */
    }
  }

  useEffect(() => {
    const notify = (key, kind, message, instanceId) => {
      if (firedRef.current.has(key)) return
      firedRef.current.add(key)
      const minutesPast = nowMinutes() - (Number(key.split('|')[2]) || 0)
      const maxLate = kind === 'upcoming' ? FRESHNESS_WINDOW_MINUTES : LATE_WINDOW_MINUTES
      if (minutesPast > maxLate) return // stale — don't spam on load

      addToast({ kind, message, instanceId })
      playNotificationSound(kind)
      // Only when the app isn't in front of the user; the toast covers that case.
      // Failures are ignored — the in-app toast already covers it.
      if (document.hidden) showSystemNotification('DayIntent', { body: message, tag: key })
    }

    const tick = async () => {
      const today = todayStr()
      const items = useEntityStore.getState().items
      const instances = await repo.getInstancesForDate(today)
      const minutesNow = nowMinutes()

      for (const instance of instances) {
        if (instance.isAllDay || !instance.time || instance.finalized) continue
        const item = items.find((i) => i.id === instance.itemId)
        if (!item) continue

        const startMinutes = timeStrToMinutes(instance.time)
        const upcomingAt = startMinutes - 10

        if (minutesNow >= upcomingAt) {
          notify(
            `${instance.id}|upcoming|${upcomingAt}`,
            'upcoming',
            `"${item.title}" starts in 10 minutes`,
            instance.id
          )
        }
        if (minutesNow >= startMinutes) {
          notify(`${instance.id}|start|${startMinutes}`, 'start', `"${item.title}" is starting now`, instance.id)
        }
        if (instance.durationMinutes != null && instance.percentComplete < 100) {
          const endMinutes = startMinutes + instance.durationMinutes
          if (minutesNow >= endMinutes) {
            notify(
              `${instance.id}|finish|${endMinutes}`,
              'finish',
              `"${item.title}" should be finishing now — mark it complete?`,
              instance.id
            )
          }
        }
      }
    }

    tick()
    const interval = setInterval(tick, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [addToast])

  if (permission !== 'default' || dismissed) return null
  return (
    <div className="notif-prompt" role="status">
      <span>Get reminders when items are about to start?</span>
      <button type="button" className="notif-prompt-enable" onClick={enable}>
        Turn on
      </button>
      <button type="button" className="notif-prompt-dismiss" onClick={dismiss} aria-label="Not now">
        ✕
      </button>
    </div>
  )
}
