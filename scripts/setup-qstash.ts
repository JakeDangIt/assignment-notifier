/**
 * Creates the repeating QStash schedule that hits /api/qstash/tick every 15 minutes.
 *
 * Usage (after env vars are set): npm run qstash:setup
 */
import { config } from "dotenv";
import { Client } from "@upstash/qstash";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  if (!token || !base) {
    throw new Error("QSTASH_TOKEN and APP_BASE_URL must be set");
  }

  const client = new Client({ token });
  const destination = `${base}/api/qstash/tick`;
  const existing = await client.schedules.list();
  const already = existing.find((schedule) => schedule.destination === destination);

  if (already) {
    console.log(`Tick schedule already exists (${already.scheduleId}) → ${destination}`);
    return;
  }

  const created = await client.schedules.create({
    destination,
    cron: "*/15 * * * *",
    retries: 2,
  });
  console.log(`Created tick schedule ${created.scheduleId} → ${destination}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
