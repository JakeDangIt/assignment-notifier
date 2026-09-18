import { BottomNav } from "@/components/BottomNav";
import { SignOutButton } from "@/components/SignOutButton";

export function AppShell({
  title,
  subtitle,
  action,
  children,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-lg flex-col px-4 safe-top">
      <header className="mb-5 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="truncate text-2xl font-semibold tracking-tight">{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-ink-muted">{subtitle}</p> : null}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {action}
          <SignOutButton />
        </div>
      </header>
      <div className="flex-1 pb-28">{children}</div>
      <BottomNav />
    </div>
  );
}
