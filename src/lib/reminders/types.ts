export type RuleKind = "offset" | "time_of_day" | "absolute";
export type RuleOrigin = "default" | "manual";
export type SubstitutionStrategyName = "evening_before" | "shift_to_quiet_end" | "drop";
export type PastReminderPolicy = "fire_now" | "skip";

export type NotificationReason =
  | "quiet_hours_substituted"
  | "quiet_hours_dropped"
  | "deduped"
  | "past_coalesced"
  | "past_skipped"
  | "overdue_nudge";

export type EngineRule = {
  id: string;
  kind: RuleKind;
  offsetMinutes: number | null;
  dayOffset: number | null;
  timeLocal: string | null;
  absoluteAt: Date | null;
  origin: RuleOrigin;
  enabled: boolean;
  label: string | null;
};

export type EngineSettings = {
  timezone: string;
  quietEnabled: boolean;
  quietStartLocal: string;
  quietEndLocal: string;
  substitutionStrategy: SubstitutionStrategyName;
  substitutionTimeLocal: string;
  allowDueTimeInQuiet: boolean;
  dedupeWindowMinutes: number;
  pastReminderPolicy: PastReminderPolicy;
  overdueNudgeEnabled: boolean;
  overdueNudgeDelayMinutes: number;
};

export type PlannedNotification = {
  ruleId: string | null;
  fireAt: Date;
  originalFireAt: Date;
  reason: NotificationReason | null;
  origin: RuleOrigin | "synthetic";
  skipped: boolean;
  label: string | null;
};

export type ComputePlanInput = {
  dueAt: Date;
  rules: EngineRule[];
  settings: EngineSettings;
  now: Date;
};
