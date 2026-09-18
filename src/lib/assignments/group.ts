import { addLocalDays, isSameLocalDay, startOfLocalDay, startOfLocalWeek } from "@/lib/time";

export type ListGroupId = "overdue" | "today" | "week" | "later" | "completed";

export const LIST_GROUP_LABELS: Record<ListGroupId, string> = {
  overdue: "Overdue",
  today: "Today",
  week: "This week",
  later: "Later",
  completed: "Completed",
};

export type GroupableAssignment = {
  id: string;
  dueAt: Date;
  completedAt: Date | null;
};

export function groupAssignments<T extends GroupableAssignment>(
  items: T[],
  now: Date,
  timezone: string,
): Record<ListGroupId, T[]> {
  const groups: Record<ListGroupId, T[]> = {
    overdue: [],
    today: [],
    week: [],
    later: [],
    completed: [],
  };

  const todayStart = startOfLocalDay(now, timezone);
  // "This week" is the rest of the current Sunday–Saturday week after today.
  const nextWeekStart = addLocalDays(startOfLocalWeek(now, timezone), 7, timezone);

  for (const item of items) {
    if (item.completedAt) {
      groups.completed.push(item);
      continue;
    }

    if (isSameLocalDay(item.dueAt, now, timezone)) {
      groups.today.push(item);
    } else if (item.dueAt < todayStart) {
      groups.overdue.push(item);
    } else if (item.dueAt < nextWeekStart) {
      groups.week.push(item);
    } else {
      groups.later.push(item);
    }
  }

  groups.completed.sort(
    (a, b) => (b.completedAt?.getTime() ?? 0) - (a.completedAt?.getTime() ?? 0),
  );

  return groups;
}
