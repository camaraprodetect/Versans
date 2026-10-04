const CACHE_VERSION = "versans-admin-20261004-push-v65";
const SW_VERSION = "20261004-push-v65";
const NOTIFICATION_ICON = "/images/apple-touch-icon.png";

self.addEventListener("install", () => {
  self.skipWaiting();
});

self.addEventListener("message", (event) => {
  const type = event && event.data && event.data.type;
  if (type === "SKIP_WAITING") {
    self.skipWaiting();
    return;
  }
  if (type === "GET_VERSION" && event.ports && event.ports[0]) {
    event.ports[0].postMessage({ version: SW_VERSION });
    return;
  }
  if (type === "CHECK_PENDING") {
    if (event.waitUntil) event.waitUntil(showPendingOrderNotifications());
  }
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

function moneyAgorot(value, currency, isHebrew) {
  const amount = Number(value || 0) / 100;
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  const currencyCode = String(currency || "ILS");

  // Keep the visible line fully in the same language/direction as the customer name.
  if (isHebrew) {
    if (currencyCode === "ILS") return `${safeAmount.toFixed(2)} ₪`;
    try {
      return new Intl.NumberFormat("he-IL", {
        style: "currency",
        currency: currencyCode,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
      }).format(safeAmount);
    } catch (_) {
      return safeAmount.toFixed(2);
    }
  }

  try {
    return new Intl.NumberFormat("en-IL", {
      style: "currency",
      currency: currencyCode,
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    }).format(safeAmount);
  } catch (_) {
    return currencyCode === "ILS" ? `₪${safeAmount.toFixed(2)}` : safeAmount.toFixed(2);
  }
}

function hasHebrewText(value) {
  return /[\u0590-\u05FF]/.test(String(value || ""));
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
    const rawCustomerName = String(order.customerName || "").trim();
    const isHebrew = hasHebrewText(rawCustomerName);
    const customerName = rawCustomerName || (isHebrew ? "לקוח/ה" : "Customer");
    const orderRef = String(order.orderRef || "");
    const total = moneyAgorot(order.amountAgorot, order.currency, isHebrew);
    const unitCount = Math.max(1, Number(order.unitCount || 1));
    const itemText = isHebrew
      ? (unitCount === 1 ? "פריט 1" : `${unitCount} פריטים`)
      : (unitCount === 1 ? "1 item" : `${unitCount} items`);
    const displayOrderNumber = orderId > 0 ? orderId : orderRef;
    const title = isHebrew
      ? `הזמנה #${displayOrderNumber}`
      : `Order #${displayOrderNumber}`;

    await self.registration.showNotification(title, {
      body: `${total}, ${itemText} • ${customerName}`,
      icon: NOTIFICATION_ICON,
      badge: NOTIFICATION_ICON,
      tag: `versans-order-${orderId || orderRef}`,
      renotify: true,
      requireInteraction: false,
      data: {
        orderId,
        orderRef,
        url: String(order.url || `/admin/order-work?order=${encodeURIComponent(orderRef)}`)
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
  const targetUrl = new URL(String(data.url || "/admin/order-work"), self.location.origin).href;

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
