import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AssignmentForm } from "@/components/AssignmentForm";
import { getAssignment, toAssignmentDTO } from "@/lib/assignments/service";
import { getSettings } from "@/lib/settings";
import { formatDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [row, settings] = await Promise.all([getAssignment(id), getSettings()]);
  if (!row) notFound();

  const assignment = toAssignmentDTO(row);

  return (
    <AppShell
      title={assignment.title}
      subtitle={
        assignment.completedAt
          ? "Completed"
          : `Due ${formatDue(assignment.dueAt, settings.timezone)}`
      }
    >
      <AssignmentForm timezone={settings.timezone} assignment={assignment} />
    </AppShell>
  );
}
