import { fail, ok, route } from "@/lib/api";
import {
  assignmentWriteSchema,
  getAssignmentDetails,
  softDeleteAssignment,
  toAssignmentDTO,
  updateAssignment,
} from "@/lib/assignments/service";

type Ctx = { params: Promise<{ id: string }> };

export const GET = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const details = await getAssignmentDetails(id);
  if (!details) return fail(404, "Assignment not found");
  return ok(details);
});

export const PATCH = route(async (request: Request, { params }: Ctx) => {
  const { id } = await params;
  const input = assignmentWriteSchema.parse(await request.json());
  const row = await updateAssignment(id, input);
  if (!row) return fail(404, "Assignment not found");
  return ok({ assignment: toAssignmentDTO(row) });
});

export const DELETE = route(async (_request: Request, { params }: Ctx) => {
  const { id } = await params;
  const row = await softDeleteAssignment(id);
  if (!row) return fail(404, "Assignment not found");
  return ok({ ok: true });
});
