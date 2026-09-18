import { ok, route } from "@/lib/api";
import { env } from "@/lib/env";

/**
 * Public by design: the VAPID public key is the applicationServerKey the
 * browser needs to create a subscription. The service worker fetches it during
 * `pushsubscriptionchange`, when no page is around to supply it.
 */
export const GET = route(
  async () => ok({ publicKey: env.vapidPublicKey }),
  { public: true },
);
