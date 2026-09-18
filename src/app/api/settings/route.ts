import { ok, route } from "@/lib/api";
import { getSettings } from "@/lib/settings";

export const GET = route(async () => {
  const row = await getSettings();
  return ok({
    settings: {
      timezone: row.timezone,
      quietEnabled: row.quietEnabled,
      quietStartLocal: row.quietStartLocal,
      quietEndLocal: row.quietEndLocal,
      substitutionStrategy: row.substitutionStrategy,
      substitutionTimeLocal: row.substitutionTimeLocal,
      allowDueTimeInQuiet: row.allowDueTimeInQuiet,
      dedupeWindowMinutes: row.dedupeWindowMinutes,
      pastReminderPolicy: row.pastReminderPolicy,
      overdueNudgeEnabled: row.overdueNudgeEnabled,
      overdueNudgeDelayMinutes: row.overdueNudgeDelayMinutes,
    },
  });
});
