import { notFound } from "next/navigation";
import { AppShell } from "@/components/AppShell";
import { AssignmentForm } from "@/components/AssignmentForm";
import { getAssignmentDetails } from "@/lib/assignments/service";
import { formatDue } from "@/lib/format";

export const dynamic = "force-dynamic";

export default async function AssignmentPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const details = await getAssignmentDetails(id);
  if (!details) notFound();

  return (
    <AppShell
      title={details.assignment.title}
      subtitle={
        details.assignment.completedAt
          ? "Completed"
          : `Due ${formatDue(details.assignment.dueAt, details.timezone)}`
      }
    >
      <AssignmentForm
        timezone={details.timezone}
        assignment={details.assignment}
        initialRules={details.rules}
      />
    </AppShell>
  );
}
