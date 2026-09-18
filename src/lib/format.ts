import { format } from "date-fns";
import { inTimeZone } from "@/lib/time";

export function formatDue(date: Date | string, timezone: string): string {
  const instant = typeof date === "string" ? new Date(date) : date;
  return format(inTimeZone(instant, timezone), "EEE, MMM d · h:mm a");
}

export function formatDueShort(date: Date | string, timezone: string): string {
  const instant = typeof date === "string" ? new Date(date) : date;
  return format(inTimeZone(instant, timezone), "MMM d, h:mm a");
}

export function formatWhen(date: Date | string, timezone: string): string {
  const instant = typeof date === "string" ? new Date(date) : date;
  return format(inTimeZone(instant, timezone), "EEE, MMM d 'at' h:mm a");
}
