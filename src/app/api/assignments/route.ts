import { ok, route } from "@/lib/api";
import { assignmentWriteSchema, createAssignment, listAssignments, toAssignmentDTO } from "@/lib/assignments/service";

export const GET = route(async () => ok({ assignments: await listAssignments() }));

export const POST = route(async (request: Request) => {
  const input = assignmentWriteSchema.parse(await request.json());
  const row = await createAssignment(input);
  return ok({ assignment: toAssignmentDTO(row) }, { status: 201 });
});
