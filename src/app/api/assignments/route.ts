import { ok, route } from "@/lib/api";
import { assignmentWriteSchema, createAssignment, listAssignments, toAssignmentDTO } from "@/lib/assignments/service";
import { requireAppUser } from "@/lib/session";

export const GET = route(async () => {
  const user = await requireAppUser();
  return ok({ assignments: await listAssignments(user.id) });
});

export const POST = route(async (request: Request) => {
  const user = await requireAppUser();
  const input = assignmentWriteSchema.parse(await request.json());
  const row = await createAssignment(user.id, input);
  return ok({ assignment: toAssignmentDTO(row) }, { status: 201 });
});
