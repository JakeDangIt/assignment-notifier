/**
 * Browser/platform capability detection for the PWA and push flows.
 *
 * These are pure functions taking their inputs explicitly so they can be unit
 * tested without a DOM.
 */

export type PlatformKind = "ios" | "android" | "desktop" | "unknown";

export function detectPlatform(userAgent: string, maxTouchPoints: number): PlatformKind {
  if (/iPad|iPhone|iPod/i.test(userAgent)) return "ios";
  // iPadOS 13+ reports a desktop Safari UA; touch points are the usual tell.
  if (/Macintosh/i.test(userAgent) && maxTouchPoints > 1) return "ios";
  if (/Android/i.test(userAgent)) return "android";
  if (/Windows|Macintosh|Linux|CrOS/i.test(userAgent)) return "desktop";
  return "unknown";
}

/**
 * Parses the iOS version out of a Safari user agent string.
 *
 * Web push landed in iOS 16.4, so we need the version to tell "your iPhone is
 * too old" apart from "you haven't installed the app yet".
 */
export function parseIosVersion(userAgent: string): { major: number; minor: number } | null {
  const match = /OS (\d+)[._](\d+)/.exec(userAgent);
  if (!match) return null;
  return { major: Number(match[1]), minor: Number(match[2]) };
}

export const MIN_IOS_PUSH_VERSION = { major: 16, minor: 4 } as const;

export function iosSupportsWebPush(version: { major: number; minor: number } | null): boolean {
  if (!version) return true; // Unknown version: assume capable rather than block the UI.
  if (version.major > MIN_IOS_PUSH_VERSION.major) return true;
  return (
    version.major === MIN_IOS_PUSH_VERSION.major &&
    version.minor >= MIN_IOS_PUSH_VERSION.minor
  );
}

/**
 * Converts a base64url VAPID public key into the Uint8Array that
 * `PushManager.subscribe` expects for `applicationServerKey`.
 */
export function urlBase64ToUint8Array(base64UrlString: string): Uint8Array {
  const padding = "=".repeat((4 - (base64UrlString.length % 4)) % 4);
  const base64 = (base64UrlString + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}
