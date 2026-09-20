import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/login", destination: "/auth/sign-in", permanent: false },
      { source: "/not-the-owner", destination: "/", permanent: false },
    ];
  },
  async headers() {
    return [
      {
        // The service worker must never be served stale, or push handler fixes
        // can take days to reach an installed PWA. `Service-Worker-Allowed`
        // lets a worker served from /sw.js control the whole origin.
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "public, max-age=0, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
        ],
      },
    ];
  },
};

export default nextConfig;
