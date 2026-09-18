import { fail, ok, route } from "@/lib/api";
import { completeAssignment, toAssignmentDTO } from "@/lib/assignments/service";

type Ctx = { params: Promise<{ id: string }> };

export const POST = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const row = await completeAssignment(id, true);
  if (!row) return fail(404, "Assignment not found");
  return ok({ assignment: toAssignmentDTO(row) });
});
