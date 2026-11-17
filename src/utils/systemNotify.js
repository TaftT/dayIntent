// OS-level notifications. Android Chrome (and installed PWAs) refuse
// `new Notification()` — they only allow notifications shown through the
// service worker registration — so go through that first and keep the
// constructor only as a desktop fallback.

export function notificationPermission() {
  return typeof Notification === 'undefined' ? 'unsupported' : Notification.permission
}

/** Must be called from a tap/click: browsers ignore or auto-block prompts that aren't. */
export async function requestNotificationPermission() {
  if (notificationPermission() === 'unsupported') return 'unsupported'
  try {
    return await Notification.requestPermission()
  } catch {
    return notificationPermission()
  }
}

/** @returns {Promise<boolean>} whether a system notification was shown */
export async function showSystemNotification(title, { body, tag } = {}) {
  if (notificationPermission() !== 'granted') return false
  const options = {
    body,
    tag, // same tag replaces instead of stacking duplicates
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    vibrate: [200, 100, 200],
    renotify: Boolean(tag),
    data: { url: '/' },
  }
  try {
    const reg = await navigator.serviceWorker?.getRegistration()
    if (reg) {
      await reg.showNotification(title, options)
      return true
    }
  } catch {
    /* fall through to the constructor */
  }
  try {
    new Notification(title, options)
    return true
  } catch {
    return false
  }
}
