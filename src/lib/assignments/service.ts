import { and, desc, eq, isNull } from "drizzle-orm";
import { z } from "zod";
import { db, assignments, type Assignment } from "@/lib/db";
import { getSettings } from "@/lib/settings";
import { parseLocalDateTime } from "@/lib/time";

export const assignmentWriteSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(4000).optional().nullable(),
  className: z.string().trim().max(120).optional().nullable(),
  /**
   * Wall-clock due time in the settings timezone, as `YYYY-MM-DDTHH:mm`.
   * Converted to UTC on the server so the client never has to know offsets.
   */
  dueAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
});

export type AssignmentWrite = z.infer<typeof assignmentWriteSchema>;

export function toAssignmentDTO(row: Assignment) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    className: row.className,
    dueAt: row.dueAt.toISOString(),
    completedAt: row.completedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listAssignments() {
  const rows = await db
    .select()
    .from(assignments)
    .where(isNull(assignments.deletedAt))
    .orderBy(assignments.dueAt, desc(assignments.createdAt));

  return rows.map(toAssignmentDTO);
}

export async function getAssignment(id: string) {
  const [row] = await db
    .select()
    .from(assignments)
    .where(and(eq(assignments.id, id), isNull(assignments.deletedAt)))
    .limit(1);

  return row ?? null;
}

export async function createAssignment(input: AssignmentWrite) {
  const settings = await getSettings();
  const dueAt = parseLocalDateTime(input.dueAtLocal, settings.timezone);

  const [row] = await db
    .insert(assignments)
    .values({
      title: input.title,
      description: emptyToNull(input.description),
      className: emptyToNull(input.className),
      dueAt,
    })
    .returning();

  return row;
}

export async function updateAssignment(id: string, input: AssignmentWrite) {
  const existing = await getAssignment(id);
  if (!existing) return null;

  const settings = await getSettings();
  const dueAt = parseLocalDateTime(input.dueAtLocal, settings.timezone);

  const [row] = await db
    .update(assignments)
    .set({
      title: input.title,
      description: emptyToNull(input.description),
      className: emptyToNull(input.className),
      dueAt,
      updatedAt: new Date(),
    })
    .where(eq(assignments.id, id))
    .returning();

  return row;
}

export async function completeAssignment(id: string, completed: boolean) {
  const existing = await getAssignment(id);
  if (!existing) return null;

  const [row] = await db
    .update(assignments)
    .set({
      completedAt: completed ? (existing.completedAt ?? new Date()) : null,
      updatedAt: new Date(),
    })
    .where(eq(assignments.id, id))
    .returning();

  return row;
}

export async function softDeleteAssignment(id: string) {
  const existing = await getAssignment(id);
  if (!existing) return null;

  const [row] = await db
    .update(assignments)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(eq(assignments.id, id))
    .returning();

  return row;
}

function emptyToNull(value: string | null | undefined): string | null {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length === 0 ? null : trimmed;
}
