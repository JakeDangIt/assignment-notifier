# Assignment Reminders

A single-user installable PWA that sends **web-push** reminders before each assignment's due date. Timed delivery uses Upstash QStash as a doorbell; the Postgres row is the source of truth, so a lost cancel can never produce a stray notification.

Stack: Next.js 15 App Router, TypeScript, Tailwind, Drizzle, Neon Postgres + Neon Auth, `web-push` + VAPID, QStash.

## What you need to create

Three free-tier accounts. **Do not paste the values into chat** — put them in Vercel env vars or `.env.local`.

1. **Neon** — a Postgres project. Copy the **pooled** connection string (the host contains `-pooler`). Then enable Auth:
   - Console: **Project → Branch → Auth → Enable Auth**
   - Copy the **Auth URL** from the Configuration tab into `NEON_AUTH_BASE_URL`
   - Add the production origin as a trusted domain (include `https://`, no trailing slash). Localhost ports are usually pre-approved.
2. **Upstash QStash** — `QSTASH_TOKEN`, `QSTASH_CURRENT_SIGNING_KEY`, `QSTASH_NEXT_SIGNING_KEY` from the QStash console. If the console region is **US**, also set `QSTASH_URL=https://qstash-us-east-1.upstash.io` (the SDK otherwise talks to EU and 404s).
3. **Vercel** — a project connected to this repo.

You also generate a VAPID keypair on your machine (this is *not* an account):

```bash
npx web-push generate-vapid-keys
```

## Environment variables

See `.env.example`. The important gotchas:

- `VAPID_SUBJECT` must be `mailto:you@example.com` or an `https://` URL. Apple's push service rejects anything else.
- `NEXT_PUBLIC_VAPID_PUBLIC_KEY` is inlined into the client bundle at **build** time. If you rotate it, redeploy.
- `APP_BASE_URL` must be the stable production domain (`https://your-app.vercel.app` or your custom domain), never a `*.vercel.app` preview URL.
- `NEON_AUTH_COOKIE_SECRET`: `openssl rand -base64 32` (32+ characters). Keep it stable across deploys; rotating it signs everyone out of the session cache.
- `OWNER_EMAIL`: the only address allowed to load assignments after a Neon sign-in. Other signed-in users see a not-the-owner page.
- `NEON_AUTH_BASE_URL`: the branch Auth URL from the Neon console, including its path (it looks like `https://ep-….neonauth….neon.tech/neondb/auth`).

## Local development

Postgres 16 on localhost is enough for CRUD and the reminder engine. Neon Auth still needs `NEON_AUTH_BASE_URL` + `NEON_AUTH_COOKIE_SECRET` + `OWNER_EMAIL` because login is no longer a local passcode.

```bash
npm install
cp .env.example .env.local
# fill DATABASE_URL, NEON_AUTH_BASE_URL, NEON_AUTH_COOKIE_SECRET, OWNER_EMAIL, and the three VAPID vars

npm run db:migrate
npm run db:seed
npm run dev
```

Open http://localhost:3000, sign in (or sign up) with `OWNER_EMAIL`, enable notifications, hit **Send test notification**.

Safari blocks the `__Secure-` session cookies Neon Auth sets unless the page is HTTPS. If sign-in appears to succeed but the next navigation bounces you back to the form, run `npm run dev -- --experimental-https` and open `https://localhost:3000`.

Useful scripts:

| Script | What it does |
| --- | --- |
| `npm test` | Reminder-engine, timezone, and owner-email unit tests |
| `npm run db:migrate` | Apply Drizzle SQL migrations |
| `npm run db:seed` | Idempotent settings row + starter default reminders |
| `npm run vapid` | Print a fresh VAPID keypair |
| `npm run qstash:setup` | Create the 15-minute tick schedule in QStash |
| `npm run icons` | Regenerate PWA icons |

Without `QSTASH_TOKEN`, reminders are still planned and stored as `pending`. Use **Log → Send now** or **Run tick** (both require being signed in as the owner) to fire them by hand.

## Deploy to Vercel

In the Neon console, **Enable Auth** on the branch this app uses, copy the Auth URL, and add `https://your-app.vercel.app` (and any custom domain) as a trusted domain.

```bash
npx vercel login
npx vercel link
npx vercel env add DATABASE_URL
npx vercel env add NEON_AUTH_BASE_URL
npx vercel env add NEON_AUTH_COOKIE_SECRET
npx vercel env add OWNER_EMAIL
npx vercel env add NEXT_PUBLIC_VAPID_PUBLIC_KEY
npx vercel env add VAPID_PRIVATE_KEY
npx vercel env add VAPID_SUBJECT
npx vercel env add QSTASH_TOKEN
npx vercel env add QSTASH_CURRENT_SIGNING_KEY
npx vercel env add QSTASH_NEXT_SIGNING_KEY
npx vercel env add QSTASH_URL
npx vercel env add APP_BASE_URL
npx vercel --prod
```

After the first production URL exists, set `APP_BASE_URL` to that origin if you used a placeholder, add that origin to Neon's trusted domains, redeploy, then:

```bash
# against production env (or copy the production values into .env.local)
npm run db:migrate
npm run db:seed
npm run qstash:setup
```

Neon: run migrate/seed from your laptop pointed at the Neon URL. QStash setup needs `QSTASH_TOKEN` + the **production** `APP_BASE_URL`.

Remove any leftover `APP_PASSCODE` / `SESSION_SECRET` Vercel env vars; they are unused.

### Deployment Protection (this will silently break reminders)

Vercel Deployment Protection, if left on, returns 401 to QStash **before** the request reaches the app. Timed reminders then never fire, and the failure looks like "QStash is broken."

In the Vercel project: **Settings → Deployment Protection → disable for Production**, or add a protection bypass that QStash can send. The QStash routes authenticate themselves with the `upstash-signature` header; they do not need Vercel's SSO gate or a Neon session.

QStash must target the production domain in `APP_BASE_URL`, not a preview deployment.

## iPhone test (iOS 16.4+)

Web push on iOS only works for a PWA added to the Home Screen and launched from that icon.

1. Open the production URL in **Safari** (not Chrome).
2. Share → Add to Home Screen → Open the icon.
3. Sign in with `OWNER_EMAIL`. The diagnostics card should read **standalone**.
4. Tap **Enable notifications** and allow the prompt.
5. Close the app fully (swipe away). Tap **Send test notification** from Settings first, while it's open, then try again after closing.
6. Create an assignment due soon with a "30 minutes before" (or **Log → Send now**) and confirm the banner arrives.

If subscribe throws in a regular Safari tab, that is expected — install first.

## How scheduling works

1. Creating/editing an assignment runs `computePlan()` (pure, fully unit-tested): offsets, quiet-hours substitution, past-coalescing, dedupe, overdue nudge.
2. Concrete rows land in `scheduled_notifications` as `pending`.
3. Anything inside `SCHEDULING_HORIZON_HOURS` (default 48) is published to QStash with `notBefore = fire_at`.
4. A QStash cron hits `/api/qstash/tick` every 15 minutes to materialize newly-entered rows and sweep anything already due that somehow wasn't delivered.
5. `/api/qstash/deliver` **claims** the row (`pending|enqueued|failed → sending`) before sending. No row returned means already sent or canceled — HTTP 200 no-op.

Quiet hours default to 12:00 AM–7:00 AM local. A reminder that would fire inside that window is moved to 9:00 PM the previous local evening (`evening_before` strategy). That strategy is a registry entry, not a hard-coded special case.

## Auth

Neon Auth (email + password) via `@neondatabase/auth`. After a valid Neon session, the signed-in email must equal `OWNER_EMAIL`. Anyone else who signs in gets a not-the-owner page and cannot call app APIs. QStash webhooks stay signature-only; they never need a browser session.
