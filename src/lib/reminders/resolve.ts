import { addLocalDays, atLocalTimeOnSameDay } from "@/lib/time";
import type { EngineRule, EngineSettings, PlannedNotification } from "./types";
import { describeRule } from "./presets";

export function resolveRule(
  rule: EngineRule,
  dueAt: Date,
  settings: EngineSettings,
): PlannedNotification {
  const fireAt = resolveInstant(rule, dueAt, settings.timezone);

  return {
    ruleId: rule.id,
    fireAt,
    originalFireAt: fireAt,
    reason: null,
    origin: rule.origin,
    skipped: false,
    label: describeRule(rule),
  };
}

function resolveInstant(rule: EngineRule, dueAt: Date, timezone: string): Date {
  switch (rule.kind) {
    case "offset": {
      const minutes = rule.offsetMinutes ?? 0;
      return new Date(dueAt.getTime() - minutes * 60_000);
    }
    case "time_of_day": {
      if (rule.dayOffset === null || !rule.timeLocal) {
        throw new Error(`time_of_day rule ${rule.id} is missing dayOffset or timeLocal`);
      }
      const day = addLocalDays(dueAt, rule.dayOffset, timezone);
      return atLocalTimeOnSameDay(day, rule.timeLocal, timezone);
    }
    case "absolute": {
      if (!rule.absoluteAt) {
        throw new Error(`absolute rule ${rule.id} is missing absoluteAt`);
      }
      return new Date(rule.absoluteAt);
    }
    default:
      throw new Error(`Unknown rule kind "${rule.kind}"`);
  }
}
