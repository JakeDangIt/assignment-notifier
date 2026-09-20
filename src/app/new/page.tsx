import { AppShell } from "@/components/AppShell";
import { AssignmentForm } from "@/components/AssignmentForm";
import { requirePageUser } from "@/lib/session";
import { getSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";
export const metadata = { title: "New assignment" };

export default async function NewAssignmentPage() {
  const user = await requirePageUser();
  const settings = await getSettings(user.id);

  return (
    <AppShell title="New assignment" subtitle={`Times are ${settings.timezone.replace(/_/g, " ")}.`}>
      <AssignmentForm timezone={settings.timezone} />
    </AppShell>
  );
}
