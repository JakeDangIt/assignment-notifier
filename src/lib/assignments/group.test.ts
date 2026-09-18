import { describe, expect, it } from "vitest";
import { groupAssignments } from "./group";
import { wallTimeToUtc } from "@/lib/time";

const TZ = "America/New_York";

function at(isoLocal: string): Date {
  return wallTimeToUtc({
    year: 2026,
    month: Number(isoLocal.slice(5, 7)),
    day: Number(isoLocal.slice(8, 10)),
    hours: Number(isoLocal.slice(11, 13) || 0),
    minutes: Number(isoLocal.slice(14, 16) || 0),
    timezone: TZ,
  });
}

describe("groupAssignments", () => {
  // Wednesday 16 Sep 2026 12:00 in New York.
  const now = at("2026-09-16T12:00");

  function item(id: string, due: string, completed = false) {
    return { id, dueAt: at(due), completedAt: completed ? at("2026-09-16T10:00") : null };
  }

  it("splits overdue, today, rest of week, later, and completed", () => {
    const groups = groupAssignments(
      [
        item("overdue", "2026-09-15T23:00"),
        item("today", "2026-09-16T18:00"),
        item("friday", "2026-09-18T09:00"),
        item("next-week", "2026-09-21T09:00"),
        item("done", "2026-09-16T08:00", true),
      ],
      now,
      TZ,
    );

    expect(groups.overdue.map((g) => g.id)).toEqual(["overdue"]);
    expect(groups.today.map((g) => g.id)).toEqual(["today"]);
    expect(groups.week.map((g) => g.id)).toEqual(["friday"]);
    expect(groups.later.map((g) => g.id)).toEqual(["next-week"]);
    expect(groups.completed.map((g) => g.id)).toEqual(["done"]);
  });

  it("treats a just-past due time today as Today, not Overdue", () => {
    const groups = groupAssignments([item("this-morning", "2026-09-16T08:00")], now, TZ);
    expect(groups.today.map((g) => g.id)).toEqual(["this-morning"]);
    expect(groups.overdue).toEqual([]);
  });
});
