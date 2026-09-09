const CACHE_NAME = "srs-v4";

const STATIC_FILES = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./apple-touch-icon.png"
];

self.addEventListener("install", event => {
  self.skipWaiting();

  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_FILES))
  );
});

self.addEventListener("activate", event => {
  event.waitUntil(
    Promise.all([
      caches.keys().then(keys =>
        Promise.all(
          keys
            .filter(key => key !== CACHE_NAME)
            .map(key => caches.delete(key))
        )
      ),
      self.clients.claim()
    ])
  );
});

self.addEventListener("fetch", event => {
  const request = event.request;

  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request)
        .then(response => {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put("./index.html", copy);
          });

          return response;
        })
        .catch(() =>
          caches.match("./index.html")
        )
    );

    return;
  }

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;

      return fetch(request).then(response => {
        if (
          request.method === "GET" &&
          response &&
          response.status === 200 &&
          response.type === "basic"
        ) {
          const copy = response.clone();

          caches.open(CACHE_NAME).then(cache => {
            cache.put(request, copy);
          });
        }

        return response;
      });
    })
  );
});

self.addEventListener("push", event => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch (err) {
    data = {
      title: "SRS Cards",
      body: event.data ? event.data.text() : "Пора повторить карточки"
    };
  }

  const title = data.title || "SRS Cards";
  const body = data.body || "Пора повторить карточки";

  event.waitUntil(
    (async () => {
      const cache = await caches.open("push-debug");

      await cache.put(
        "./push-last.txt",
        new Response(new Date().toISOString())
      );

      try {
        await self.registration.showNotification(title, {
  body: body,
  icon: "./icon-192.png",
  tag: data.tag || "srs-review",
  renotify: true,
  data: {
    url: data.url || "./"
  }
});

        await cache.put(
          "./push-result.txt",
          new Response("SHOW_NOTIFICATION_OK")
        );
      } catch (err) {
        await cache.put(
          "./push-result.txt",
          new Response(
            "SHOW_NOTIFICATION_ERROR: " +
            (err?.name || "") +
            " " +
            (err?.message || String(err))
          )
        );
      }
    })()
  );
});
self.addEventListener("notificationclick", event => {
  event.notification.close();

  const url = event.notification.data?.url || "./";

  event.waitUntil(
    clients.matchAll({
      type: "window",
      includeUncontrolled: true
    }).then(windowClients => {
      for (const client of windowClients) {
        if ("focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }

      return clients.openWindow(url);
    })
  );
});
