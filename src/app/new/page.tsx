import { AppShell } from "@/components/AppShell";
import { AssignmentForm } from "@/components/AssignmentForm";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "New assignment" };

export default async function NewAssignmentPage() {
  const settings = await getSettings();

  return (
    <AppShell title="New assignment" subtitle={`Times are ${settings.timezone.replace(/_/g, " ")}.`}>
      <AssignmentForm timezone={settings.timezone} />
    </AppShell>
  );
}
