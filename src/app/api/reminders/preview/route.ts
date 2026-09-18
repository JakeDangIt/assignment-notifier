import { z } from "zod";
import { ok, route } from "@/lib/api";
import { ruleInputSchema } from "@/lib/assignments/service";
import { computePlan } from "@/lib/reminders";
import { toEngineSettings } from "@/lib/reminders/map";
import { getSettings } from "@/lib/settings";
import { parseLocalDateTime } from "@/lib/time";

const previewSchema = z.object({
  dueAtLocal: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/),
  rules: z.array(ruleInputSchema),
});

export const POST = route(async (request: Request) => {
  const body = previewSchema.parse(await request.json());
  const settings = await getSettings();
  const dueAt = parseLocalDateTime(body.dueAtLocal, settings.timezone);

  const planned = computePlan({
    dueAt,
    rules: body.rules.map((rule, index) => {
      if (rule.kind === "offset") {
        return {
          id: `preview-${index}`,
          kind: "offset" as const,
          offsetMinutes: rule.offsetMinutes,
          dayOffset: null,
          timeLocal: null,
          absoluteAt: null,
          origin: rule.origin ?? "manual",
          enabled: rule.enabled ?? true,
          label: rule.label ?? null,
        };
      }
      if (rule.kind === "time_of_day") {
        return {
          id: `preview-${index}`,
          kind: "time_of_day" as const,
          offsetMinutes: null,
          dayOffset: rule.dayOffset,
          timeLocal: rule.timeLocal.length === 5 ? `${rule.timeLocal}:00` : rule.timeLocal,
          absoluteAt: null,
          origin: rule.origin ?? "manual",
          enabled: rule.enabled ?? true,
          label: rule.label ?? null,
        };
      }
      return {
        id: `preview-${index}`,
        kind: "absolute" as const,
        offsetMinutes: null,
        dayOffset: null,
        timeLocal: null,
        absoluteAt: parseLocalDateTime(rule.absoluteAtLocal, settings.timezone),
        origin: rule.origin ?? "manual",
        enabled: rule.enabled ?? true,
        label: rule.label ?? "Custom time",
      };
    }),
    settings: toEngineSettings(settings),
    now: new Date(),
  });

  return ok({
    timezone: settings.timezone,
    planned: planned.map((item) => ({
      ruleId: item.ruleId,
      fireAt: item.fireAt.toISOString(),
      originalFireAt: item.originalFireAt.toISOString(),
      reason: item.reason,
      origin: item.origin,
      skipped: item.skipped,
      label: item.label,
    })),
  });
});
