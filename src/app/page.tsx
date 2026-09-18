import { InstallStatus } from "@/components/InstallStatus";
import { PwaDiagnostics } from "@/components/PwaDiagnostics";
import { SignOutButton } from "@/components/SignOutButton";

export default function HomePage() {
  return (
    <main className="mx-auto w-full max-w-lg px-4 safe-top safe-bottom">
      <header className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Assignment Reminders</h1>
          <p className="mt-1 text-sm text-ink-muted">
            Timed push reminders before every due date.
          </p>
        </div>
        <SignOutButton />
      </header>

      <div className="space-y-4">
        <InstallStatus />
        <PwaDiagnostics />
      </div>
    </main>
  );
}
