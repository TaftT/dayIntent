// Pulled into the generated service worker (see vite.config.js importScripts).
// Tapping a reminder brings the app forward instead of doing nothing.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const open = clients.find((c) => 'focus' in c)
      if (open) return open.focus()
      return self.clients.openWindow('/')
    }),
  )
})
