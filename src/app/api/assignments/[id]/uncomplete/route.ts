import { fail, ok, route } from "@/lib/api";
import { completeAssignment, toAssignmentDTO } from "@/lib/assignments/service";
import { requireAppUser } from "@/lib/session";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, { params }: Ctx) => {
  const user = await requireAppUser();
  const { id } = await params;
  const row = await completeAssignment(id, user.id, false);
  if (!row) return fail(404, "Assignment not found");
  return ok({ assignment: toAssignmentDTO(row) });
});
