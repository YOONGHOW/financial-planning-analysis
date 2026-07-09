// Service Worker for Financial Planning & Analysis (PWA) Task Reminders
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

let uncompletedTasks = [];
let notificationInterval = null;

// Listen for messages from client windows
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SET_TASKS') {
    uncompletedTasks = event.data.tasks || [];
    resetNotificationTimer();
  }
});

function resetNotificationTimer() {
  if (notificationInterval) {
    clearInterval(notificationInterval);
    notificationInterval = null;
  }

  if (uncompletedTasks.length > 0) {
    // Standard reminder interval: 2 hours (2 * 60 * 60 * 1000)
    const TWO_HOURS_MS = 2 * 60 * 60 * 1000;
    
    // Trigger immediately on first setting if there are tasks, or start interval
    notificationInterval = setInterval(() => {
      sendTaskNotification();
    }, TWO_HOURS_MS);
  }
}

function sendTaskNotification() {
  if (uncompletedTasks.length === 0) return;

  const pendingCount = uncompletedTasks.length;
  const title = `Task Reminder: ${pendingCount} Active Task${pendingCount > 1 ? 's' : ''}`;
  const body = uncompletedTasks
    .slice(0, 3)
    .map((t) => `• [${t.priority}] ${t.title}`)
    .join('\n') + (pendingCount > 3 ? `\n...and ${pendingCount - 3} more` : '');

  self.registration.showNotification(title, {
    body: body,
    icon: '/logo.png',
    badge: '/logo.png',
    vibrate: [200, 100, 200],
    tag: 'pwa-task-reminder',
    requireInteraction: true, // Keep notification visible until actioned
    data: {
      url: '/tasks'
    }
  });
}

// Handle notification click (redirect to app)
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || '/tasks';

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes(targetUrl) && 'focus' in client) {
          return client.focus();
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(targetUrl);
      }
    })
  );
});
