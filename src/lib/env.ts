import "server-only";

/**
 * Server-side environment access.
 *
 * Values are read lazily rather than validated in one shot at import time:
 * `next build` imports route modules without the runtime secrets present, and
 * failing there would break deploys. Each accessor throws only when something
 * actually needs the value.
 */

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `Missing required environment variable ${name}. See .env.example for setup.`,
    );
  }
  return value;
}

function optional(name: string): string | undefined {
  return process.env[name] || undefined;
}

function integer(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed)) {
    throw new Error(`Environment variable ${name} must be an integer, got "${raw}".`);
  }
  return parsed;
}

export const env = {
  get databaseUrl() {
    return required("DATABASE_URL");
  },
  get appPasscode() {
    return required("APP_PASSCODE");
  },
  get sessionSecret() {
    return required("SESSION_SECRET");
  },
  get vapidPublicKey() {
    return required("NEXT_PUBLIC_VAPID_PUBLIC_KEY");
  },
  get vapidPrivateKey() {
    return required("VAPID_PRIVATE_KEY");
  },
  get vapidSubject() {
    return required("VAPID_SUBJECT");
  },
  get qstashToken() {
    return optional("QSTASH_TOKEN");
  },
  /**
   * Regional QStash API. The SDK's default (`https://qstash.upstash.io`) is the
   * EU cluster. A US-console token then fails with "user not found in this
   * region (eu-central-1)". US accounts must use the us-east-1 URL.
   */
  get qstashUrl() {
    return optional("QSTASH_URL") ?? "https://qstash-us-east-1.upstash.io";
  },
  get qstashCurrentSigningKey() {
    return optional("QSTASH_CURRENT_SIGNING_KEY");
  },
  get qstashNextSigningKey() {
    return optional("QSTASH_NEXT_SIGNING_KEY");
  },
  /**
   * Public origin QStash calls back into. Falls back to Vercel's per-deployment
   * URL, but should be set explicitly to the stable production domain: QStash
   * messages outlive the deployment that created them.
   */
  get appBaseUrl() {
    const explicit = optional("APP_BASE_URL");
    if (explicit) return explicit.replace(/\/$/, "");
    const vercelUrl = optional("VERCEL_PROJECT_PRODUCTION_URL") ?? optional("VERCEL_URL");
    if (vercelUrl) return `https://${vercelUrl}`;
    return "http://localhost:3000";
  },
  /** How far ahead reminders get handed to QStash. See src/lib/scheduler. */
  get schedulingHorizonHours() {
    return integer("SCHEDULING_HORIZON_HOURS", 48);
  },
  /**
   * When set, scheduling runs in DB-only mode: notifications are still planned
   * and stored, but nothing is handed to QStash. Lets the app run locally
   * without an Upstash account.
   */
  get schedulingEnabled() {
    return Boolean(optional("QSTASH_TOKEN")) && optional("DISABLE_SCHEDULING") !== "1";
  },
  get isProduction() {
    return process.env.NODE_ENV === "production";
  },
};
