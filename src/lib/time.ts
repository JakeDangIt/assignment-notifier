import { TZDate } from "@date-fns/tz";
import {
  addDays,
  differenceInCalendarDays,
  endOfWeek,
  isAfter,
  isBefore,
  isSameDay,
  startOfDay,
  startOfWeek,
} from "date-fns";

/**
 * Zone-aware wall-clock helpers.
 *
 * Every timestamp in the database is UTC. Anything that looks like a clock
 * time ("due 8:30 AM", "quiet hours 12–7") is interpreted in the single IANA
 * timezone from Settings, never in the server's zone.
 */

export function parseTimeParts(timeLocal: string): {
  hours: number;
  minutes: number;
  seconds: number;
} {
  const [hours = "0", minutes = "0", seconds = "0"] = timeLocal.split(":");
  return {
    hours: Number.parseInt(hours, 10),
    minutes: Number.parseInt(minutes, 10),
    seconds: Number.parseInt(seconds, 10),
  };
}

/** Minutes since local midnight, used for quiet-hours window checks. */
export function timeToMinutes(timeLocal: string): number {
  const { hours, minutes } = parseTimeParts(timeLocal);
  return hours * 60 + minutes;
}

export function minutesToTime(total: number): string {
  const normalized = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const hours = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`;
}

/** Interprets a UTC instant as a civil datetime in `timezone`. */
export function inTimeZone(date: Date, timezone: string): TZDate {
  return new TZDate(date.getTime(), timezone);
}

export function wallTimeToUtc(parts: {
  year: number;
  /** 1–12 */
  month: number;
  day: number;
  hours: number;
  minutes: number;
  seconds?: number;
  timezone: string;
}): Date {
  const tzDate = new TZDate(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hours,
    parts.minutes,
    parts.seconds ?? 0,
    parts.timezone,
  );
  return new Date(tzDate.getTime());
}

/**
 * Parses a `datetime-local` value (`YYYY-MM-DDTHH:mm`) as a wall time in the
 * given zone and returns the corresponding UTC instant.
 */
export function parseLocalDateTime(local: string, timezone: string): Date {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(local);
  if (!match) {
    throw new Error(`Invalid local datetime "${local}". Expected YYYY-MM-DDTHH:mm.`);
  }

  return wallTimeToUtc({
    year: Number(match[1]),
    month: Number(match[2]),
    day: Number(match[3]),
    hours: Number(match[4]),
    minutes: Number(match[5]),
    seconds: Number(match[6] ?? 0),
    timezone,
  });
}

/** Inverse of `parseLocalDateTime`, for filling `<input type="datetime-local">`. */
export function formatLocalDateTime(date: Date, timezone: string): string {
  const zoned = inTimeZone(date, timezone);
  const yyyy = String(zoned.getFullYear()).padStart(4, "0");
  const mm = String(zoned.getMonth() + 1).padStart(2, "0");
  const dd = String(zoned.getDate()).padStart(2, "0");
  const hh = String(zoned.getHours()).padStart(2, "0");
  const min = String(zoned.getMinutes()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}

export function formatLocalDate(date: Date, timezone: string): string {
  return formatLocalDateTime(date, timezone).slice(0, 10);
}

/** Local clock time of an instant, as Postgres-style `HH:MM:SS`. */
export function formatLocalClock(date: Date, timezone: string): string {
  const zoned = inTimeZone(date, timezone);
  const hh = String(zoned.getHours()).padStart(2, "0");
  const min = String(zoned.getMinutes()).padStart(2, "0");
  const ss = String(zoned.getSeconds()).padStart(2, "0");
  return `${hh}:${min}:${ss}`;
}

export function localMinutes(date: Date, timezone: string): number {
  const zoned = inTimeZone(date, timezone);
  return zoned.getHours() * 60 + zoned.getMinutes();
}

export function startOfLocalDay(date: Date, timezone: string): Date {
  const zoned = inTimeZone(date, timezone);
  return wallTimeToUtc({
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hours: 0,
    minutes: 0,
    seconds: 0,
    timezone,
  });
}

export function addLocalDays(date: Date, days: number, timezone: string): Date {
  const zoned = inTimeZone(date, timezone);
  const shifted = addDays(zoned, days);
  return wallTimeToUtc({
    year: shifted.getFullYear(),
    month: shifted.getMonth() + 1,
    day: shifted.getDate(),
    hours: shifted.getHours(),
    minutes: shifted.getMinutes(),
    seconds: shifted.getSeconds(),
    timezone,
  });
}

/**
 * Instant of `timeLocal` on the same civil day as `date` in `timezone`.
 * Used for "morning of" / "night before" rules and quiet-hours substitution.
 */
export function atLocalTimeOnSameDay(date: Date, timeLocal: string, timezone: string): Date {
  const zoned = inTimeZone(date, timezone);
  const { hours, minutes, seconds } = parseTimeParts(timeLocal);
  return wallTimeToUtc({
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hours,
    minutes,
    seconds,
    timezone,
  });
}

export function isInQuietWindow(
  date: Date,
  timezone: string,
  startLocal: string,
  endLocal: string,
): boolean {
  const start = timeToMinutes(startLocal);
  const end = timeToMinutes(endLocal);
  if (start === end) return false;

  const minutes = localMinutes(date, timezone);
  if (start < end) return minutes >= start && minutes < end;
  // Window wraps midnight, e.g. 22:00–07:00.
  return minutes >= start || minutes < end;
}

export function startOfLocalWeek(date: Date, timezone: string): Date {
  const zoned = startOfWeek(inTimeZone(date, timezone), { weekStartsOn: 0 });
  return wallTimeToUtc({
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hours: 0,
    minutes: 0,
    seconds: 0,
    timezone,
  });
}

export function endOfLocalWeek(date: Date, timezone: string): Date {
  const zoned = endOfWeek(inTimeZone(date, timezone), { weekStartsOn: 0 });
  return wallTimeToUtc({
    year: zoned.getFullYear(),
    month: zoned.getMonth() + 1,
    day: zoned.getDate(),
    hours: 23,
    minutes: 59,
    seconds: 59,
    timezone,
  });
}

export function isSameLocalDay(a: Date, b: Date, timezone: string): boolean {
  return isSameDay(inTimeZone(a, timezone), inTimeZone(b, timezone));
}

export function localCalendarDaysBetween(later: Date, earlier: Date, timezone: string): number {
  return differenceInCalendarDays(inTimeZone(later, timezone), inTimeZone(earlier, timezone));
}

export { isAfter, isBefore, startOfDay };
