import type { Settings } from "@/lib/db";
import type { EngineRule, EngineSettings } from "@/lib/reminders/types";
import type { DefaultReminderRule, ReminderRule } from "@/lib/db";

export function toEngineSettings(row: Settings): EngineSettings {
  return {
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
  };
}

export function toEngineRule(row: ReminderRule | DefaultReminderRule): EngineRule {
  return {
    id: row.id,
    kind: row.kind,
    offsetMinutes: row.offsetMinutes,
    dayOffset: row.dayOffset,
    timeLocal: row.timeLocal,
    absoluteAt: "absoluteAt" in row ? (row.absoluteAt ?? null) : null,
    origin: "origin" in row ? row.origin : "default",
    enabled: row.enabled,
    label: row.label,
  };
}
