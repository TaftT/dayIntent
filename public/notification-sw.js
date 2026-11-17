// Pulled into the generated service worker (see vite.config.js importScripts).
// Tapping a reminder opens that item on the calendar; its "Mark complete"
// button completes it. The app does the actual work (it owns the data and the
// sync), so this just hands it the request: to an open window if there is one,
// otherwise by launching the app with the request in the URL.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const data = event.notification.data || {}
  const action = event.action === 'complete' ? 'complete' : 'open'
  const message = { type: 'dayintent-notification', action, instanceId: data.instanceId, itemId: data.itemId, date: data.date, time: data.time }
  const params = new URLSearchParams({ notif: action })
  for (const k of ['instanceId', 'itemId', 'date', 'time']) if (data[k]) params.set(k, data[k])

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c)
      if (open) {
        open.postMessage(message)
        return open.focus()
      }
      return self.clients.openWindow('/?' + params.toString())
    }),
  )
})
