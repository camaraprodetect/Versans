const CACHE_VERSION = "versans-admin-v3-order-push";
const NOTIFICATION_ICON = "/images/apple-touch-icon.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith("versans-admin-") && key !== CACHE_VERSION)
          .map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// Admin data is deliberately never cached. Requests always go to the server
// so private order/customer information is not stored by the service worker.
self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(fetch(event.request));
});

function moneyAgorot(value, currency) {
  const amount = Number(value || 0) / 100;
  try {
    return new Intl.NumberFormat("he-IL", {
      style: "currency",
      currency: String(currency || "ILS"),
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(Number.isFinite(amount) ? amount : 0);
  } catch (_) {
    return "₪" + (Number.isFinite(amount) ? amount.toFixed(2) : "0.00");
  }
}

async function showPendingOrderNotifications() {
  const response = await fetch("/api/admin/push/pending", {
    method: "GET",
    credentials: "include",
    cache: "no-store",
    headers: { Accept: "application/json" }
  });
  if (!response.ok) return;

  const payload = await response.json().catch(() => ({}));
  const orders = Array.isArray(payload.orders) ? payload.orders : [];
  if (!orders.length) return;

  let highestOrderId = 0;
  for (const order of orders) {
    const orderId = Number(order.orderId || 0);
    highestOrderId = Math.max(highestOrderId, orderId);
    const customerName = String(order.customerName || "לקוח/ה");
    const orderRef = String(order.orderRef || "");
    const total = moneyAgorot(order.amountAgorot, order.currency);

    await self.registration.showNotification("הזמנה חדשה ב-VerSans 🎉", {
      body: `${customerName}\nמספר הזמנה: ${orderRef}\nסכום: ${total}`,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: `versans-order-${orderId || orderRef}`,
      renotify: true,
      requireInteraction: false,
      data: {
        orderId,
        orderRef,
        url: String(order.url || `/admin/orders?order=${encodeURIComponent(orderRef)}`)
      }
    });
  }

  if (highestOrderId > 0) {
    await fetch("/api/admin/push/ack", {
      method: "POST",
      credentials: "include",
      cache: "no-store",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-Versans-Admin-Push": "1"
      },
      body: JSON.stringify({ orderId: highestOrderId })
    }).catch(() => null);
  }
}

self.addEventListener("push", (event) => {
  event.waitUntil(showPendingOrderNotifications());
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const data = event.notification.data || {};
  const targetUrl = new URL(String(data.url || "/admin/orders"), self.location.origin).href;

  event.waitUntil((async () => {
    const windows = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    for (const client of windows) {
      if (!client || !client.url || new URL(client.url).origin !== self.location.origin) continue;
      try {
        await client.navigate(targetUrl);
        await client.focus();
        return;
      } catch (_) {}
    }
    if (self.clients.openWindow) await self.clients.openWindow(targetUrl);
  })());
});
