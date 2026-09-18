import "server-only";
import { Client, Receiver } from "@upstash/qstash";
import { env } from "@/lib/env";

function getClient(): Client {
  const token = env.qstashToken;
  if (!token) {
    throw new Error("QSTASH_TOKEN is not set");
  }
  return new Client({ token });
}

export async function publishAt(
  notificationId: string,
  fireAt: Date,
): Promise<{ messageId: string | null; enqueued: boolean }> {
  const notBefore = Math.floor(fireAt.getTime() / 1000);
  const nowSeconds = Math.floor(Date.now() / 1000);

  const result = await getClient().publishJSON({
    url: `${env.appBaseUrl}/api/qstash/deliver`,
    body: { notificationId },
    // A timestamp in the past would fire immediately, which is what we want
    // for coalesced "fire now" reminders.
    notBefore: Math.max(notBefore, nowSeconds),
    retries: 3,
  });

  return { messageId: result.messageId, enqueued: true };
}

export async function cancelMessage(messageId: string): Promise<void> {
  try {
    await getClient().messages.cancel(messageId);
  } catch (error) {
    // Already delivered or never existed — the DB row is what actually gates send.
    console.warn(`QStash cancel failed for ${messageId}`, error);
  }
}

export async function verifyQstashSignature(request: Request, body: string): Promise<boolean> {
  const current = env.qstashCurrentSigningKey;
  const next = env.qstashNextSigningKey;
  if (!current || !next) return false;

  const signature = request.headers.get("upstash-signature");
  if (!signature) return false;

  const receiver = new Receiver({ currentSigningKey: current, nextSigningKey: next });
  try {
    return await receiver.verify({
      signature,
      body,
      url: `${env.appBaseUrl}${new URL(request.url).pathname}`,
    });
  } catch {
    return false;
  }
}

export async function ensureTickSchedule() {
  const client = getClient();
  const destination = `${env.appBaseUrl}/api/qstash/tick`;
  const existing = await client.schedules.list();
  const already = existing.find((schedule) => schedule.destination === destination);
  if (already) {
    return { scheduleId: already.scheduleId, created: false };
  }

  const created = await client.schedules.create({
    destination,
    cron: "*/15 * * * *",
    retries: 2,
  });
  return { scheduleId: created.scheduleId, created: true };
}
