import { AppShell } from "@/components/AppShell";
import { CalendarView } from "@/components/CalendarView";
import { listAssignments } from "@/lib/assignments/service";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "Calendar" };

export default async function CalendarPage() {
  const [items, settings] = await Promise.all([listAssignments(), getSettings()]);

  return (
    <AppShell title="Calendar" subtitle="Dots mark days with something due.">
      <CalendarView assignments={items} timezone={settings.timezone} />
    </AppShell>
  );
}
