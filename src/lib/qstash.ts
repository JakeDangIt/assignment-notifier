import "server-only";

/**
 * Thin QStash client. Filled out in M6; these stubs exist so the scheduler can
 * typecheck before QStash credentials are present. `scheduler.ts` only imports
 * this module when `QSTASH_TOKEN` is set.
 */

export async function publishAt(
  notificationId: string,
  fireAt: Date,
): Promise<{ messageId: string | null; enqueued: boolean }> {
  void notificationId;
  void fireAt;
  throw new Error("QStash publish is not configured yet");
}

export async function cancelMessage(messageId: string): Promise<void> {
  void messageId;
}

export async function verifyQstashSignature(request: Request, body: string): Promise<boolean> {
  void request;
  void body;
  return false;
}
