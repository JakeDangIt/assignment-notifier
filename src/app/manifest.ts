import type { MetadataRoute } from "next";

/**
 * Served by Next at /manifest.webmanifest with the correct MIME type.
 *
 * `display: "standalone"` is load-bearing on iOS: web push is only delivered to
 * a PWA that was added to the Home Screen and launches without browser chrome.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Assignment Reminders",
    short_name: "Assignments",
    description:
      "Track assignments and get timed push reminders before every due date.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b1020",
    theme_color: "#0b1020",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-192.png", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
