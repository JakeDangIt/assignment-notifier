import { AssignmentFab, AssignmentList, NewAssignmentButton } from "@/components/AssignmentList";
import { AppShell } from "@/components/AppShell";
import { listAssignments } from "@/lib/assignments/service";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [items, settings] = await Promise.all([listAssignments(), getSettings()]);

  return (
    <AppShell
      title="Assignments"
      subtitle="What's due, grouped by when."
      action={<NewAssignmentButton />}
    >
      <AssignmentList initial={items} timezone={settings.timezone} />
      <AssignmentFab />
    </AppShell>
  );
}
