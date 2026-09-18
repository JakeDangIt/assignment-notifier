/**
 * Creates the repeating QStash schedule that hits /api/qstash/tick every 15 minutes.
 *
 * Usage (after env vars are set): npm run qstash:setup
 *
 * QStash regions are isolated. The SDK defaults to EU; a token minted in the
 * US console then 404s with "user not found in this region (eu-central-1)".
 * We try US first, then EU, unless QSTASH_URL is set.
 */
import { config } from "dotenv";
import { Client } from "@upstash/qstash";

config({ path: ".env.local", quiet: true });
config({ path: ".env", quiet: true });

const US_URL = "https://qstash-us-east-1.upstash.io";
const EU_URL = "https://qstash.upstash.io";

async function main() {
  const token = process.env.QSTASH_TOKEN;
  const base = (process.env.APP_BASE_URL ?? "").replace(/\/$/, "");
  if (!token || !base) {
    throw new Error("QSTASH_TOKEN and APP_BASE_URL must be set");
  }

  const { client, url } = await resolveClient(token);
  const destination = `${base}/api/qstash/tick`;
  const existing = await client.schedules.list();
  const already = existing.find((schedule) => schedule.destination === destination);

  if (already) {
    console.log(`Tick schedule already exists (${already.scheduleId})`);
  } else {
    const created = await client.schedules.create({
      destination,
      cron: "*/15 * * * *",
      retries: 2,
    });
    console.log(`Created tick schedule ${created.scheduleId}`);
  }

  console.log(`QStash API:    ${url}`);
  console.log(`Tick target:   ${destination}`);
  console.log("");
  console.log("Put the same region URL in Vercel (Production) if it is not already set:");
  console.log(`  QSTASH_URL=${url}`);
  console.log(`  APP_BASE_URL=${base}`);
}

async function resolveClient(token: string): Promise<{ client: Client; url: string }> {
  const explicit = process.env.QSTASH_URL?.replace(/\/$/, "");
  const candidates = explicit ? [explicit] : [US_URL, EU_URL];
  const errors: string[] = [];

  for (const url of candidates) {
    const client = new Client({ token, baseUrl: url });
    try {
      await client.schedules.list();
      return { client, url };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      errors.push(`${url}: ${message}`);
    }
  }

  throw new Error(
    `Could not reach QStash with this token in any region.\n${errors.join("\n")}\n` +
      "In the Upstash console, open QStash, check the region switcher (US vs EU), " +
      "and copy QSTASH_URL plus the token/signing keys from that same region.",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
