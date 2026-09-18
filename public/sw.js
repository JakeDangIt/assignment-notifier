/* eslint-disable no-undef */
/**
 * Service worker for Assignment Reminders.
 *
 * Deliberately hand-written rather than generated: the push behaviour here has
 * hard platform requirements (see below) that are easier to audit in one file
 * than to infer from a build plugin's output.
 *
 * iOS notes that drive this implementation:
 *  - A `push` event MUST result in showNotification(). iOS revokes the push
 *    subscription if a push is handled "silently", so every failure path below
 *    still shows something.
 *  - Notification `actions` are not supported, so the payload stays minimal.
 */

const CACHE_VERSION = "v1";
const SHELL_CACHE = `shell-${CACHE_VERSION}`;

/** Assets worth having available on a cold, offline launch. */
const SHELL_ASSETS = ["/offline", "/icons/icon-192.png", "/icons/badge-96.png"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL_CACHE);
      // Individually tolerant: one missing asset must not fail the install.
      await Promise.allSettled(SHELL_ASSETS.map((asset) => cache.add(asset)));
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys.filter((key) => key !== SHELL_CACHE).map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

/**
 * Network-first for navigations, falling back to the cached offline page.
 * API traffic is never cached: stale assignment data would be worse than an error.
 */
self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cache = await caches.open(SHELL_CACHE);
          return (await cache.match("/offline")) ?? Response.error();
        }
      })(),
    );
    return;
  }

  if (SHELL_ASSETS.includes(url.pathname)) {
    event.respondWith(
      (async () => {
        const cache = await caches.open(SHELL_CACHE);
        const cached = await cache.match(request);
        return cached ?? fetch(request);
      })(),
    );
  }
});

/**
 * Parses a push payload defensively. A malformed or empty payload must still
 * produce a visible notification rather than throwing.
 */
function parsePushPayload(event) {
  const fallback = {
    title: "Assignment reminder",
    body: "Open the app to see what's due.",
    url: "/",
    tag: undefined,
  };

  if (!event.data) return fallback;

  try {
    const data = event.data.json();
    return {
      title: typeof data.title === "string" && data.title ? data.title : fallback.title,
      body: typeof data.body === "string" && data.body ? data.body : fallback.body,
      url: typeof data.url === "string" && data.url ? data.url : fallback.url,
      tag: typeof data.tag === "string" ? data.tag : undefined,
    };
  } catch {
    const text = event.data.text();
    return { ...fallback, body: text || fallback.body };
  }
}

self.addEventListener("push", (event) => {
  const payload = parsePushPayload(event);

  event.waitUntil(
    self.registration.showNotification(payload.title, {
      body: payload.body,
      icon: "/icons/icon-192.png",
      badge: "/icons/badge-96.png",
      // A stable tag collapses repeat reminders for the same assignment into a
      // single notification instead of stacking them up.
      tag: payload.tag,
      renotify: Boolean(payload.tag),
      data: { url: payload.url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = event.notification.data?.url ?? "/";

  event.waitUntil(
    (async () => {
      const clientList = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });

      for (const client of clientList) {
        if ("focus" in client) {
          await client.focus();
          if ("navigate" in client) {
            try {
              await client.navigate(target);
            } catch {
              // Cross-origin or detached client; focusing alone is enough.
            }
          }
          return;
        }
      }

      await self.clients.openWindow(target);
    })(),
  );
});

/**
 * Fired when the browser rotates the subscription's keys. Chrome honours this;
 * Safari currently does not, which is why the client also revalidates its
 * subscription on every launch.
 */
self.addEventListener("pushsubscriptionchange", (event) => {
  event.waitUntil(
    (async () => {
      try {
        const response = await fetch("/api/push/vapid-public-key");
        if (!response.ok) return;
        const { publicKey } = await response.json();
        if (!publicKey) return;

        const subscription = await self.registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: publicKey,
        });

        await fetch("/api/push/subscribe", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            subscription: subscription.toJSON(),
            oldEndpoint: event.oldSubscription?.endpoint ?? null,
          }),
        });
      } catch {
        // Nothing useful to do here; the next app launch re-runs this flow.
      }
    })(),
  );
});
