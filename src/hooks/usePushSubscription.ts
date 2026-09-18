"use client";

import { useCallback, useEffect, useState } from "react";
import { urlBase64ToUint8Array } from "@/lib/pwa";

export type PushState =
  | "loading"
  | "unsupported"
  | "denied"
  | "unsubscribed"
  | "subscribed";

type Action = "subscribe" | "unsubscribe" | "test" | null;

async function resolveVapidKey(): Promise<string> {
  const inlined = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (inlined) return inlined;

  // Fallback for deployments where the public key wasn't present at build time.
  const response = await fetch("/api/push/vapid-public-key");
  if (!response.ok) throw new Error("Could not load the VAPID public key");
  const { publicKey } = await response.json();
  if (!publicKey) throw new Error("Server has no VAPID public key configured");
  return publicKey;
}

async function postJson(url: string, body: unknown) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error ?? `Request to ${url} failed`);
  }

  return response.json();
}

/**
 * Owns this browser's push subscription: create, remove, and keep the server's
 * copy in sync.
 */
export function usePushSubscription() {
  const [state, setState] = useState<PushState>("loading");
  const [pending, setPending] = useState<Action>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<string | null>(null);

  /**
   * Reads the browser's real subscription and re-registers it server-side.
   *
   * The re-register matters on iOS: Safari doesn't fire
   * `pushsubscriptionchange`, so a subscription silently rotated by the OS
   * would leave the server pushing to a dead endpoint until the next launch.
   */
  const sync = useCallback(async () => {
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }

    if (Notification.permission === "denied") {
      setState("denied");
      return;
    }

    const registration = await navigator.serviceWorker.ready;
    const subscription = await registration.pushManager.getSubscription();

    if (!subscription) {
      setState("unsubscribed");
      return;
    }

    try {
      await postJson("/api/push/subscribe", { subscription: subscription.toJSON() });
    } catch {
      // A failed re-register shouldn't flip the UI to "off" while the browser
      // still holds a valid subscription.
    }

    setState("subscribed");
  }, []);

  useEffect(() => {
    void sync();
  }, [sync]);

  const subscribe = useCallback(async () => {
    setPending("subscribe");
    setError(null);

    try {
      // Must run inside the click that triggered this call: iOS only honours
      // a permission request made during a user gesture.
      const permission = await Notification.requestPermission();
      if (permission !== "granted") {
        setState(permission === "denied" ? "denied" : "unsubscribed");
        setError(
          permission === "denied"
            ? "Notifications are blocked. Enable them for this app in your device settings."
            : "Notification permission was dismissed.",
        );
        return;
      }

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          // Required to be true by every browser, and mandatory on iOS: a push
          // that doesn't show a notification gets the subscription revoked.
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(await resolveVapidKey()),
        }));

      await postJson("/api/push/subscribe", { subscription: subscription.toJSON() });
      setState("subscribed");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not enable notifications");
    } finally {
      setPending(null);
    }
  }, []);

  const unsubscribe = useCallback(async () => {
    setPending("unsubscribe");
    setError(null);

    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();

      if (subscription) {
        await postJson("/api/push/unsubscribe", { endpoint: subscription.endpoint });
        await subscription.unsubscribe();
      }

      setState("unsubscribed");
      setLastTestResult(null);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not turn off notifications");
    } finally {
      setPending(null);
    }
  }, []);

  const sendTest = useCallback(async () => {
    setPending("test");
    setError(null);
    setLastTestResult(null);

    try {
      const result = await postJson("/api/push/test", {});
      setLastTestResult(
        `Sent to ${result.succeeded} of ${result.attempted} device${result.attempted === 1 ? "" : "s"}.`,
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Test notification failed");
    } finally {
      setPending(null);
    }
  }, []);

  return { state, pending, error, lastTestResult, subscribe, unsubscribe, sendTest, refresh: sync };
}
