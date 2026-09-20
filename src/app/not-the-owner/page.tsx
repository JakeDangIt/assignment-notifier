import { SignOutButton } from "@/components/SignOutButton";
import { auth } from "@/lib/auth";

export const dynamic = "force-dynamic";

export const metadata = { title: "Not the owner · Assignment Reminders" };

export default async function NotTheOwnerPage() {
  const { data: session } = await auth.getSession();
  const email = session?.user?.email;

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-6 text-center">
      <h1 className="text-2xl font-semibold tracking-tight">This account can&rsquo;t use the app</h1>
      <p className="mt-3 text-sm text-ink-muted">
        Assignment Reminders is a single-person tool. You&rsquo;re signed in
        {email ? (
          <>
            {" "}
            as <span className="text-ink">{email}</span>
          </>
        ) : null}
        , which isn&rsquo;t the owner email. Sign out and use that address instead.
      </p>
      <div className="mt-6 flex justify-center">
        <SignOutButton />
      </div>
    </main>
  );
}
