"use client";

import { usePushSubscription } from "@/hooks/usePushSubscription";
import { usePwaStatus } from "@/hooks/usePwaStatus";
import { Badge, Button, Card, CardTitle } from "@/components/ui";

/**
 * Turns push on or off for this device and sends a real test notification.
 *
 * Hidden behind the install gate on iOS: `pushManager.subscribe()` throws
 * outright in a normal Safari tab, so offering the button there would only
 * produce a confusing error.
 */
export function NotificationSetup() {
  const pwa = usePwaStatus();
  const { state, pending, error, lastTestResult, subscribe, unsubscribe, sendTest } =
    usePushSubscription();

  if (!pwa.ready || state === "loading") {
    return (
      <Card>
        <div className="h-5 w-40 animate-pulse rounded bg-surface-raised" />
      </Card>
    );
  }

  if (pwa.blocker === "ios-needs-install" || pwa.blocker === "ios-too-old") {
    // The install card already explains what to do; don't duplicate it.
    return null;
  }

  if (state === "unsupported") {
    return (
      <Card className="border-danger/30">
        <CardTitle>Notifications unavailable</CardTitle>
        <p className="mt-1 text-sm text-ink-muted">
          This browser doesn&rsquo;t support the Web Push API.
        </p>
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Notifications</CardTitle>
        <Badge tone={state === "subscribed" ? "success" : state === "denied" ? "danger" : "warning"}>
          {state === "subscribed" ? "On" : state === "denied" ? "Blocked" : "Off"}
        </Badge>
      </div>

      <p className="mt-1 text-sm text-ink-muted">
        {state === "subscribed"
          ? "This device will receive reminders, even when the app is closed."
          : state === "denied"
            ? "Notifications are blocked for this app. Re-enable them in your device settings, then reload."
            : "Turn on notifications to receive reminders on this device."}
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {state === "subscribed" ? (
          <>
            <Button variant="secondary" disabled={pending !== null} onClick={sendTest}>
              {pending === "test" ? "Sending…" : "Send test notification"}
            </Button>
            <Button variant="ghost" disabled={pending !== null} onClick={unsubscribe}>
              {pending === "unsubscribe" ? "Turning off…" : "Turn off"}
            </Button>
          </>
        ) : (
          <Button disabled={pending !== null || state === "denied"} onClick={subscribe}>
            {pending === "subscribe" ? "Enabling…" : "Enable notifications"}
          </Button>
        )}
      </div>

      {lastTestResult ? (
        <p className="mt-3 text-sm text-success">{lastTestResult}</p>
      ) : null}
      {error ? (
        <p role="alert" className="mt-3 text-sm text-danger">
          {error}
        </p>
      ) : null}
    </Card>
  );
}
