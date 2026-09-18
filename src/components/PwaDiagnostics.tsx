"use client";

import { useEffect, useState } from "react";
import { usePwaStatus } from "@/hooks/usePwaStatus";
import { Badge, Card, CardTitle } from "@/components/ui";

type SwState = "checking" | "unsupported" | "none" | ServiceWorkerState;

/**
 * Surfaces the platform facts that decide whether push can work.
 *
 * Kept in the UI (rather than left to devtools) because the device that matters
 * is a phone, where opening a console is impractical.
 */
export function PwaDiagnostics() {
  const status = usePwaStatus();
  const [swState, setSwState] = useState<SwState>("checking");

  useEffect(() => {
    if (!("serviceWorker" in navigator)) {
      setSwState("unsupported");
      return;
    }

    let cancelled = false;

    const check = async () => {
      const registration = await navigator.serviceWorker.getRegistration("/");
      if (cancelled) return;

      const worker = registration?.active ?? registration?.installing ?? registration?.waiting;
      setSwState(worker?.state ?? "none");
    };

    void check();
    const interval = setInterval(check, 2000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const rows: Array<{ label: string; value: string; ok: boolean | null }> = [
    {
      label: "Display mode",
      value: status.ready ? (status.isStandalone ? "standalone" : "browser tab") : "…",
      ok: status.ready ? status.isStandalone : null,
    },
    {
      label: "Platform",
      value: status.ready
        ? status.platform === "ios" && status.iosVersion
          ? `iOS ${status.iosVersion.major}.${status.iosVersion.minor}`
          : status.platform
        : "…",
      ok: null,
    },
    {
      label: "Service worker",
      value: swState,
      ok: swState === "activated" ? true : swState === "checking" ? null : false,
    },
    {
      label: "Push APIs",
      value: status.ready ? (status.hasPushApis ? "available" : "missing") : "…",
      ok: status.ready ? status.hasPushApis : null,
    },
    {
      label: "Notification permission",
      value: status.notificationPermission,
      ok: status.notificationPermission === "granted"
        ? true
        : status.notificationPermission === "denied"
          ? false
          : null,
    },
  ];

  return (
    <Card>
      <CardTitle>Diagnostics</CardTitle>
      <dl className="mt-3 divide-y divide-border">
        {rows.map((row) => (
          <div key={row.label} className="flex items-center justify-between gap-3 py-2">
            <dt className="text-sm text-ink-muted">{row.label}</dt>
            <dd>
              <Badge tone={row.ok === true ? "success" : row.ok === false ? "danger" : "neutral"}>
                <span className="font-mono">{row.value}</span>
              </Badge>
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
