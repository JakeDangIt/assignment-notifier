/**
 * Cached by the service worker at install time and served for navigations that
 * fail while offline.
 */
export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-lg flex-col items-center justify-center px-6 text-center">
      <h1 className="text-xl font-semibold">You&rsquo;re offline</h1>
      <p className="mt-2 text-sm text-ink-muted">
        Assignment data needs a connection. Your scheduled reminders are stored on the
        server, so they&rsquo;ll still arrive.
      </p>
    </main>
  );
}
