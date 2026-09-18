"use client";

import { useEffect, useState } from "react";
import {
  detectPlatform,
  iosSupportsWebPush,
  parseIosVersion,
  type PlatformKind,
} from "@/lib/pwa";

export type PwaStatus = {
  /** False until the first client-side effect runs, so SSR markup stays stable. */
  ready: boolean;
  isStandalone: boolean;
  platform: PlatformKind;
  iosVersion: { major: number; minor: number } | null;
  /** The browser exposes the APIs needed for web push. */
  hasPushApis: boolean;
  /** True when this device could receive push if the user grants permission. */
  canUsePush: boolean;
  /** Why push is unavailable, when it is. */
  blocker: "unsupported-browser" | "ios-too-old" | "ios-needs-install" | null;
  notificationPermission: NotificationPermission | "unavailable";
};

const INITIAL: PwaStatus = {
  ready: false,
  isStandalone: false,
  platform: "unknown",
  iosVersion: null,
  hasPushApis: false,
  canUsePush: false,
  blocker: null,
  notificationPermission: "unavailable",
};

function read(): PwaStatus {
  const userAgent = navigator.userAgent;
  const platform = detectPlatform(userAgent, navigator.maxTouchPoints ?? 0);
  const iosVersion = platform === "ios" ? parseIosVersion(userAgent) : null;

  const isStandalone =
    window.matchMedia("(display-mode: standalone)").matches ||
    // Non-standard, iOS-only, and still the most reliable signal on Safari.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true;

  const hasPushApis =
    "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;

  let blocker: PwaStatus["blocker"] = null;
  if (!hasPushApis) {
    blocker = "unsupported-browser";
  } else if (platform === "ios" && !iosSupportsWebPush(iosVersion)) {
    blocker = "ios-too-old";
  } else if (platform === "ios" && !isStandalone) {
    // iOS only delivers push to a Home Screen install, and subscribe() throws
    // in a normal Safari tab.
    blocker = "ios-needs-install";
  }

  return {
    ready: true,
    isStandalone,
    platform,
    iosVersion,
    hasPushApis,
    canUsePush: blocker === null,
    blocker,
    notificationPermission: hasPushApis ? Notification.permission : "unavailable",
  };
}

/**
 * Tracks installability and push capability of the current browser session.
 *
 * Re-reads on visibility changes because the user may grant notification
 * permission in system settings while the app is backgrounded.
 */
export function usePwaStatus(): PwaStatus {
  const [status, setStatus] = useState<PwaStatus>(INITIAL);

  useEffect(() => {
    setStatus(read());

    const refresh = () => setStatus(read());
    const displayModeQuery = window.matchMedia("(display-mode: standalone)");

    displayModeQuery.addEventListener("change", refresh);
    document.addEventListener("visibilitychange", refresh);

    return () => {
      displayModeQuery.removeEventListener("change", refresh);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, []);

  return status;
}
