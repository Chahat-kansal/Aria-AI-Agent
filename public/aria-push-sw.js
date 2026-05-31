self.addEventListener("install", (event) => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch {
    payload = {};
  }

  const title = typeof payload.title === "string" ? payload.title : "Aria";
  const body = typeof payload.body === "string" ? payload.body : "Open Aria to review.";
  const route = typeof payload.route === "string" && payload.route.startsWith("/") ? payload.route : "/app/overview";
  const tag = typeof payload.tag === "string" ? payload.tag : "aria-notification";

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      tag,
      data: { route },
      renotify: false
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const route = event.notification?.data?.route && String(event.notification.data.route).startsWith("/")
    ? String(event.notification.data.route)
    : "/app/overview";

  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if ("focus" in client) {
          client.navigate(route);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(route);
      return undefined;
    })
  );
});
