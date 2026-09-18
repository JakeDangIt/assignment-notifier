"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { addMonths } from "date-fns";
import type { AssignmentDTO } from "@/lib/api-client";
import { formatDueShort } from "@/lib/format";
import {
  addLocalDays,
  formatLocalDate,
  inTimeZone,
  isSameLocalDay,
  startOfLocalWeek,
  wallTimeToUtc,
} from "@/lib/time";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function CalendarView({
  assignments,
  timezone,
}: {
  assignments: AssignmentDTO[];
  timezone: string;
}) {
  const today = new Date();
  const zonedToday = inTimeZone(today, timezone);
  const [cursor, setCursor] = useState({
    year: zonedToday.getFullYear(),
    month: zonedToday.getMonth() + 1,
  });
  const [selectedDay, setSelectedDay] = useState(formatLocalDate(today, timezone));

  const monthStart = wallTimeToUtc({
    year: cursor.year,
    month: cursor.month,
    day: 1,
    hours: 0,
    minutes: 0,
    timezone,
  });

  const gridStart = startOfLocalWeek(monthStart, timezone);

  const days = useMemo(() => {
    const cells: Date[] = [];
    let cursorDay = gridStart;
    // 6 weeks covers every month regardless of start weekday.
    for (let i = 0; i < 42; i++) {
      cells.push(cursorDay);
      cursorDay = addLocalDays(cursorDay, 1, timezone);
    }
    return cells;
  }, [gridStart, timezone]);

  const byDay = useMemo(() => {
    const map = new Map<string, AssignmentDTO[]>();
    for (const assignment of assignments) {
      if (assignment.completedAt) continue;
      const key = formatLocalDate(new Date(assignment.dueAt), timezone);
      const list = map.get(key) ?? [];
      list.push(assignment);
      map.set(key, list);
    }
    return map;
  }, [assignments, timezone]);

  const selected = byDay.get(selectedDay) ?? [];
  const title = inTimeZone(monthStart, timezone).toLocaleString("en-US", {
    month: "long",
    year: "numeric",
    timeZone: timezone,
  });

  const shiftMonth = (delta: number) => {
    const shifted = addMonths(new Date(cursor.year, cursor.month - 1, 1), delta);
    setCursor({ year: shifted.getFullYear(), month: shifted.getMonth() + 1 });
  };

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface-raised"
          onClick={() => shiftMonth(-1)}
          aria-label="Previous month"
        >
          ‹
        </button>
        <h2 className="text-base font-semibold">{title}</h2>
        <button
          type="button"
          className="rounded-lg px-2 py-1 text-ink-muted hover:bg-surface-raised"
          onClick={() => shiftMonth(1)}
          aria-label="Next month"
        >
          ›
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-[11px] font-medium uppercase tracking-wider text-ink-subtle">
        {WEEKDAYS.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-y-1">
        {days.map((day) => {
          const key = formatLocalDate(day, timezone);
          const inMonth = inTimeZone(day, timezone).getMonth() + 1 === cursor.month;
          const isToday = isSameLocalDay(day, today, timezone);
          const isSelected = key === selectedDay;
          const count = byDay.get(key)?.length ?? 0;

          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelectedDay(key)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-xl text-sm",
                !inMonth && "text-ink-subtle/50",
                isSelected && "bg-accent-strong text-white",
                !isSelected && isToday && "border border-accent text-accent",
              )}
            >
              {inTimeZone(day, timezone).getDate()}
              <span className="mt-0.5 flex h-1.5 gap-0.5">
                {count > 0 ? (
                  <span
                    className={cn(
                      "size-1.5 rounded-full",
                      isSelected ? "bg-white" : "bg-accent",
                    )}
                  />
                ) : (
                  <span className="size-1.5" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      <section className="mt-5">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          {selectedDay}
        </h3>
        {selected.length === 0 ? (
          <p className="text-sm text-ink-muted">Nothing due this day.</p>
        ) : (
          <ul className="space-y-2">
            {selected.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/assignments/${item.id}`}
                  className="block rounded-2xl border border-border bg-surface px-3 py-3"
                >
                  <p className="font-medium">{item.title}</p>
                  <p className="text-sm text-ink-muted">{formatDueShort(item.dueAt, timezone)}</p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
