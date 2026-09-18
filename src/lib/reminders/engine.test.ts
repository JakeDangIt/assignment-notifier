import { describe, expect, it } from "vitest";
import { computePlan } from "./index";
import { parseLocalDateTime } from "@/lib/time";
import type { EngineRule, EngineSettings } from "./types";

const TZ = "America/New_York";

function settings(overrides: Partial<EngineSettings> = {}): EngineSettings {
  return {
    timezone: TZ,
    quietEnabled: true,
    quietStartLocal: "00:00:00",
    quietEndLocal: "07:00:00",
    substitutionStrategy: "evening_before",
    substitutionTimeLocal: "21:00:00",
    allowDueTimeInQuiet: true,
    dedupeWindowMinutes: 15,
    pastReminderPolicy: "fire_now",
    overdueNudgeEnabled: false,
    overdueNudgeDelayMinutes: 60,
    ...overrides,
  };
}

function offset(id: string, minutes: number, origin: EngineRule["origin"] = "default"): EngineRule {
  return {
    id,
    kind: "offset",
    offsetMinutes: minutes,
    dayOffset: null,
    timeLocal: null,
    absoluteAt: null,
    origin,
    enabled: true,
    label: null,
  };
}

function timeOfDay(
  id: string,
  dayOffset: number,
  timeLocal: string,
  origin: EngineRule["origin"] = "default",
): EngineRule {
  return {
    id,
    kind: "time_of_day",
    offsetMinutes: null,
    dayOffset,
    timeLocal,
    absoluteAt: null,
    origin,
    enabled: true,
    label: null,
  };
}

function local(stamp: string): Date {
  return parseLocalDateTime(stamp, TZ);
}

function fireStamps(plan: ReturnType<typeof computePlan>, includeSkipped = false) {
  return plan
    .filter((item) => includeSkipped || !item.skipped)
    .map((item) => ({
      id: item.ruleId,
      fire: item.fireAt.toISOString(),
      original: item.originalFireAt.toISOString(),
      reason: item.reason,
      skipped: item.skipped,
    }));
}

describe("computePlan", () => {
  it("substitutes a 1-hour-before reminder that lands in quiet hours to 9 PM the night before", () => {
    // Due 7:30 AM; "1 hour before" is 6:30 AM, which sits inside 00:00–07:00.
    const plan = computePlan({
      dueAt: local("2026-09-18T07:30"),
      rules: [offset("1h", 60)],
      settings: settings(),
      now: local("2026-09-01T12:00"),
    });

    expect(fireStamps(plan)).toEqual([
      {
        id: "1h",
        fire: local("2026-09-17T21:00").toISOString(),
        original: local("2026-09-18T06:30").toISOString(),
        reason: "quiet_hours_substituted",
        skipped: false,
      },
    ]);
  });

  it("does not move a reminder that is outside quiet hours", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T18:00"),
      rules: [offset("1h", 60)],
      settings: settings(),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].skipped).toBe(false);
    expect(plan[0].reason).toBeNull();
    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-18T17:00").toISOString());
  });

  it("lets an at-due-time reminder fire inside quiet hours when allowed", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T06:00"),
      rules: [offset("due", 0)],
      settings: settings({ allowDueTimeInQuiet: true }),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-18T06:00").toISOString());
    expect(plan[0].reason).toBeNull();
  });

  it("moves an at-due-time reminder when the exemption is off", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T06:00"),
      rules: [offset("due", 0)],
      settings: settings({ allowDueTimeInQuiet: false }),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-17T21:00").toISOString());
    expect(plan[0].reason).toBe("quiet_hours_substituted");
  });

  it("handles a quiet window that wraps midnight", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T23:30"),
      rules: [offset("30m", 30)],
      settings: settings({
        quietStartLocal: "23:00:00",
        quietEndLocal: "07:00:00",
      }),
      now: local("2026-09-01T12:00"),
    });

    // 23:00 is inside 23:00–07:00, so it moves to 21:00 the previous local day.
    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-17T21:00").toISOString());
    expect(plan[0].reason).toBe("quiet_hours_substituted");
  });

  it("uses shift_to_quiet_end when that strategy is selected", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T07:30"),
      rules: [offset("1h", 60)],
      settings: settings({ substitutionStrategy: "shift_to_quiet_end" }),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-18T07:00").toISOString());
  });

  it("drops the reminder when the drop strategy is selected", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T07:30"),
      rules: [offset("1h", 60)],
      settings: settings({ substitutionStrategy: "drop" }),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].skipped).toBe(true);
    expect(plan[0].reason).toBe("quiet_hours_dropped");
  });

  it("coalesces several already-past reminders into a single immediate send", () => {
    const now = local("2026-09-18T10:00");
    const plan = computePlan({
      dueAt: local("2026-09-18T10:30"),
      rules: [offset("1d", 24 * 60), offset("3h", 180), offset("1h", 60)],
      settings: settings(),
      now,
    });

    const live = plan.filter((item) => !item.skipped);
    const skipped = plan.filter((item) => item.skipped);

    expect(live).toHaveLength(1);
    expect(live[0].reason).toBe("past_coalesced");
    expect(live[0].fireAt.toISOString()).toBe(now.toISOString());
    expect(live[0].ruleId).toBe("1h");
    expect(skipped).toHaveLength(2);
    expect(skipped.every((item) => item.reason === "past_skipped")).toBe(true);
  });

  it("skips past reminders entirely when the policy is skip", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T10:30"),
      rules: [offset("1h", 60), offset("3h", 180)],
      settings: settings({ pastReminderPolicy: "skip" }),
      now: local("2026-09-18T10:00"),
    });

    expect(plan.every((item) => item.skipped && item.reason === "past_skipped")).toBe(true);
  });

  it("does not fire past offsets immediately when the assignment is already overdue", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T08:00"),
      rules: [offset("1h", 60)],
      settings: settings(),
      now: local("2026-09-18T12:00"),
    });

    expect(plan[0].skipped).toBe(true);
    expect(plan[0].reason).toBe("past_skipped");
  });

  it("dedupes two substitutions that land on the same 9 PM slot", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T07:00"),
      rules: [offset("3h", 180), offset("1h", 60)],
      settings: settings(),
      now: local("2026-09-01T12:00"),
    });

    const live = plan.filter((item) => !item.skipped);
    const skipped = plan.filter((item) => item.skipped);

    expect(live).toHaveLength(1);
    expect(live[0].ruleId).toBe("1h");
    expect(live[0].fireAt.toISOString()).toBe(local("2026-09-17T21:00").toISOString());
    expect(skipped[0].reason).toBe("deduped");
  });

  it("prefers a manual reminder over a default when they collide", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T18:00"),
      rules: [
        offset("default-1h", 60, "default"),
        offset("manual-1h", 60, "manual"),
      ],
      settings: settings(),
      now: local("2026-09-01T12:00"),
    });

    const live = plan.filter((item) => !item.skipped);
    expect(live).toHaveLength(1);
    expect(live[0].ruleId).toBe("manual-1h");
  });

  it("resolves a morning-of time_of_day rule on the due date", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T16:00"),
      rules: [timeOfDay("morning", 0, "09:00:00")],
      settings: settings(),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-18T09:00").toISOString());
  });

  it("resolves a night-before time_of_day rule", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T08:30"),
      rules: [timeOfDay("night", -1, "21:00:00")],
      settings: settings(),
      now: local("2026-09-01T12:00"),
    });

    expect(plan[0].fireAt.toISOString()).toBe(local("2026-09-17T21:00").toISOString());
  });

  it("shifts an overdue nudge forward out of quiet hours, never backward", () => {
    const plan = computePlan({
      dueAt: local("2026-09-18T05:00"),
      rules: [],
      settings: settings({ overdueNudgeEnabled: true, overdueNudgeDelayMinutes: 60 }),
      now: local("2026-09-01T12:00"),
    });

    const nudge = plan.find((item) => item.reason === "overdue_nudge");
    expect(nudge).toBeTruthy();
    // Raw fire is 06:00 (quiet) → 07:00, not 21:00 the night before.
    expect(nudge!.fireAt.toISOString()).toBe(local("2026-09-18T07:00").toISOString());
  });

  it("fires an overdue nudge immediately when the assignment is already overdue", () => {
    const now = local("2026-09-18T12:00");
    const plan = computePlan({
      dueAt: local("2026-09-18T08:00"),
      rules: [],
      settings: settings({ overdueNudgeEnabled: true, overdueNudgeDelayMinutes: 60 }),
      now,
    });

    const nudge = plan.find((item) => item.reason === "overdue_nudge" && !item.skipped);
    expect(nudge!.fireAt.toISOString()).toBe(now.toISOString());
  });

  it("keeps offset math as a duration across a spring-forward DST boundary", () => {
    // 2026-03-08 02:00 does not exist in America/New_York (clocks jump to 03:00).
    // "3 hours before" 05:00 EDT is a 3-hour duration, not a 3-hour clock rewind.
    const due = local("2026-03-08T05:00");
    const plan = computePlan({
      dueAt: due,
      rules: [offset("3h", 180)],
      settings: settings({ quietEnabled: false }),
      now: local("2026-03-01T12:00"),
    });

    expect(plan[0].fireAt.getTime()).toBe(due.getTime() - 3 * 60 * 60 * 1000);
  });

  it("places a time_of_day reminder on the correct civil day around a DST fallback", () => {
    // 2026-11-01 is the EST/EDT fallback. "Morning of" 09:00 must still be 09:00 local.
    const plan = computePlan({
      dueAt: local("2026-11-01T16:00"),
      rules: [timeOfDay("morning", 0, "09:00:00")],
      settings: settings({ quietEnabled: false }),
      now: local("2026-10-20T12:00"),
    });

    expect(plan[0].fireAt.toISOString()).toBe(local("2026-11-01T09:00").toISOString());
  });
});
