import { AppShell } from "@/components/AppShell";
import { Card } from "@/components/ui";

export const metadata = { title: "Delivery log" };

export default function LogPage() {
  return (
    <AppShell title="Delivery log" subtitle="Sent, pending, and failed reminders.">
      <Card>
        <p className="text-sm text-ink-muted">
          The log fills in once timed delivery is wired up. Create an assignment in the meantime —
          it will show up here after the first reminder fires.
        </p>
      </Card>
    </AppShell>
  );
}
