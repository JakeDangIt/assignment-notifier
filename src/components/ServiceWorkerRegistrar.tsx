"use client";

import { useEffect } from "react";

/**
 * Registers the service worker once per page load.
 *
 * Rendered in the root layout so the worker is installed before the user ever
 * reaches the notification settings; push subscription requires an active
 * registration to already exist.
 */
export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
      console.error("Service worker registration failed", error);
    });
  }, []);

  return null;
}
