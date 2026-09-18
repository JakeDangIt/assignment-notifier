import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ServiceWorkerRegistrar } from "@/components/ServiceWorkerRegistrar";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Assignment Reminders",
  description:
    "Track assignments and get timed push reminders before every due date.",
  manifest: "/manifest.webmanifest",
  // `capable` emits apple-mobile-web-app-capable, which iOS requires before it
  // will treat a Home Screen launch as a standalone app (and thus allow push).
  appleWebApp: {
    capable: true,
    title: "Assignments",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180" }],
  },
  formatDetection: { telephone: false, date: false, address: false, email: false },
  other: {
    // Next only emits the standardised `mobile-web-app-capable`. iOS 16.4-17.x
    // recognise just Apple's legacy name, and without it a Home Screen launch
    // can keep Safari chrome -- which in turn blocks push.
    "apple-mobile-web-app-capable": "yes",
  },
};

export const viewport: Viewport = {
  themeColor: "#0b1020",
  // Required for env(safe-area-inset-*) to report real values on notched iPhones.
  viewportFit: "cover",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <ServiceWorkerRegistrar />
        {children}
      </body>
    </html>
  );
}
