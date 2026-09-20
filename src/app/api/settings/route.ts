import { z } from "zod";
import { ok, route } from "@/lib/api";
import { getSettings, serializeSettings, updateSettings } from "@/lib/settings";
import { requireAppUser } from "@/lib/session";

const timeSchema = z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/);

const patchSchema = z.object({
  timezone: z.string().min(1).max(80),
  quietEnabled: z.boolean(),
  quietStartLocal: timeSchema,
  quietEndLocal: timeSchema,
  substitutionStrategy: z.enum(["evening_before", "shift_to_quiet_end", "drop"]),
  substitutionTimeLocal: timeSchema,
  allowDueTimeInQuiet: z.boolean(),
  dedupeWindowMinutes: z.number().int().min(0).max(24 * 60),
  pastReminderPolicy: z.enum(["fire_now", "skip"]),
  overdueNudgeEnabled: z.boolean(),
  overdueNudgeDelayMinutes: z.number().int().min(0).max(7 * 24 * 60),
});

function withSeconds(value: string): string {
  return value.length === 5 ? `${value}:00` : value;
}

function assertTimeZone(timezone: string) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(new Date());
  } catch {
    throw new Error(`Unknown timezone "${timezone}"`);
  }
}

export const GET = route(async () => {
  const user = await requireAppUser();
  return ok({ settings: serializeSettings(await getSettings(user.id)) });
});

export const PUT = route(async (request: Request) => {
  const user = await requireAppUser();
  const input = patchSchema.parse(await request.json());
  assertTimeZone(input.timezone);

  const row = await updateSettings(user.id, {
    timezone: input.timezone,
    quietEnabled: input.quietEnabled,
    quietStartLocal: withSeconds(input.quietStartLocal),
    quietEndLocal: withSeconds(input.quietEndLocal),
    substitutionStrategy: input.substitutionStrategy,
    substitutionTimeLocal: withSeconds(input.substitutionTimeLocal),
    allowDueTimeInQuiet: input.allowDueTimeInQuiet,
    dedupeWindowMinutes: input.dedupeWindowMinutes,
    pastReminderPolicy: input.pastReminderPolicy,
    overdueNudgeEnabled: input.overdueNudgeEnabled,
    overdueNudgeDelayMinutes: input.overdueNudgeDelayMinutes,
  });

  return ok({ settings: serializeSettings(row) });
});
