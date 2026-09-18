/**
 * Human-facing reminder presets, shared by the seed script, the reminder editor
 * and the settings UI so labels never drift between them.
 */

export type RuleSpec =
  | { kind: "offset"; offsetMinutes: number }
  | { kind: "time_of_day"; dayOffset: number; timeLocal: string }
  | { kind: "absolute"; absoluteAt: Date };

export type RulePreset = {
  id: string;
  label: string;
  spec: Exclude<RuleSpec, { kind: "absolute" }>;
};

const MINUTE = 1;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

export const RULE_PRESETS: readonly RulePreset[] = [
  { id: "1w", label: "1 week before", spec: { kind: "offset", offsetMinutes: 7 * DAY } },
  { id: "3d", label: "3 days before", spec: { kind: "offset", offsetMinutes: 3 * DAY } },
  { id: "1d", label: "1 day before", spec: { kind: "offset", offsetMinutes: DAY } },
  { id: "12h", label: "12 hours before", spec: { kind: "offset", offsetMinutes: 12 * HOUR } },
  { id: "6h", label: "6 hours before", spec: { kind: "offset", offsetMinutes: 6 * HOUR } },
  { id: "3h", label: "3 hours before", spec: { kind: "offset", offsetMinutes: 3 * HOUR } },
  { id: "1h", label: "1 hour before", spec: { kind: "offset", offsetMinutes: HOUR } },
  { id: "30m", label: "30 minutes before", spec: { kind: "offset", offsetMinutes: 30 } },
  { id: "0m", label: "At due time", spec: { kind: "offset", offsetMinutes: 0 } },
  {
    id: "morning-of",
    label: "Morning of",
    spec: { kind: "time_of_day", dayOffset: 0, timeLocal: "09:00:00" },
  },
  {
    id: "night-before",
    label: "Night before",
    spec: { kind: "time_of_day", dayOffset: -1, timeLocal: "21:00:00" },
  },
];

/** The default set applied to new assignments on a fresh install. */
export const STARTER_DEFAULT_RULE_IDS = ["1d", "3h", "1h"] as const;

export function presetById(id: string): RulePreset | undefined {
  return RULE_PRESETS.find((preset) => preset.id === id);
}

/** Renders an arbitrary minutes-before value, including ones with no preset. */
export function formatOffsetLabel(offsetMinutes: number): string {
  if (offsetMinutes === 0) return "At due time";
  if (offsetMinutes < 0) return `${formatDuration(-offsetMinutes)} after due`;
  return `${formatDuration(offsetMinutes)} before`;
}

function formatDuration(minutes: number): string {
  const parts: string[] = [];
  const days = Math.floor(minutes / DAY);
  const hours = Math.floor((minutes % DAY) / HOUR);
  const mins = minutes % HOUR;

  if (days) parts.push(`${days} ${days === 1 ? "day" : "days"}`);
  if (hours) parts.push(`${hours} ${hours === 1 ? "hour" : "hours"}`);
  if (mins) parts.push(`${mins} ${mins === 1 ? "minute" : "minutes"}`);

  return parts.join(" ") || "0 minutes";
}

/** Formats "HH:MM:SS" (Postgres `time`) as a friendly 12-hour clock time. */
export function formatLocalTime(timeLocal: string): string {
  const [hourRaw, minuteRaw] = timeLocal.split(":");
  const hour24 = Number.parseInt(hourRaw ?? "0", 10);
  const minute = Number.parseInt(minuteRaw ?? "0", 10);
  const suffix = hour24 < 12 ? "AM" : "PM";
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  return `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

export function formatDayOffset(dayOffset: number): string {
  if (dayOffset === 0) return "day of";
  if (dayOffset === -1) return "day before";
  if (dayOffset < 0) return `${-dayOffset} days before`;
  return `${dayOffset} days after`;
}

/** One-line description of any rule, used in lists and the delivery log. */
export function describeRule(rule: {
  kind: string;
  offsetMinutes: number | null;
  dayOffset: number | null;
  timeLocal: string | null;
  label: string | null;
}): string {
  if (rule.label) return rule.label;

  switch (rule.kind) {
    case "offset":
      return formatOffsetLabel(rule.offsetMinutes ?? 0);
    case "time_of_day":
      return `${formatLocalTime(rule.timeLocal ?? "00:00:00")}, ${formatDayOffset(rule.dayOffset ?? 0)}`;
    case "absolute":
      return "Custom time";
    default:
      return "Reminder";
  }
}
