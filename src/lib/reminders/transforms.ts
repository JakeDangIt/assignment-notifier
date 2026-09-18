import { isInQuietWindow } from "@/lib/time";
import { getSubstitutionStrategy, shiftToQuietEnd } from "./strategies";
import type { EngineSettings, PlannedNotification, SubstitutionStrategyName } from "./types";

const DUE_TIME_EPSILON_MS = 1_000;

function clone(item: PlannedNotification): PlannedNotification {
  return { ...item, fireAt: new Date(item.fireAt), originalFireAt: new Date(item.originalFireAt) };
}

export function applyQuietHours(
  items: PlannedNotification[],
  dueAt: Date,
  settings: EngineSettings,
  options: { strategy?: SubstitutionStrategyName } = {},
): PlannedNotification[] {
  if (!settings.quietEnabled) return items.map(clone);

  const strategyName = options.strategy ?? settings.substitutionStrategy;
  const strategy = getSubstitutionStrategy(strategyName);

  return items.map((item) => {
    const next = clone(item);
    if (next.skipped) return next;

    const isDueTime = Math.abs(next.fireAt.getTime() - dueAt.getTime()) < DUE_TIME_EPSILON_MS;
    if (isDueTime && settings.allowDueTimeInQuiet) return next;

    if (
      !isInQuietWindow(
        next.fireAt,
        settings.timezone,
        settings.quietStartLocal,
        settings.quietEndLocal,
      )
    ) {
      return next;
    }

    const { fireAt } = strategy({ fireAt: next.fireAt, dueAt, settings });
    if (!fireAt) {
      next.skipped = true;
      next.reason = "quiet_hours_dropped";
      return next;
    }

    next.fireAt = fireAt;
    next.reason = "quiet_hours_substituted";
    return next;
  });
}

/**
 * Quiet-hours pass that always uses `shift_to_quiet_end`, regardless of the
 * user's configured strategy. Overdue nudges must move forward, never back.
 */
export function applyOverdueQuietHours(
  items: PlannedNotification[],
  dueAt: Date,
  settings: EngineSettings,
): PlannedNotification[] {
  if (!settings.quietEnabled) return items.map(clone);

  return items.map((item) => {
    const next = clone(item);
    if (next.skipped) return next;
    if (
      !isInQuietWindow(
        next.fireAt,
        settings.timezone,
        settings.quietStartLocal,
        settings.quietEndLocal,
      )
    ) {
      return next;
    }

    const { fireAt } = shiftToQuietEnd({ fireAt: next.fireAt, dueAt, settings });
    if (!fireAt) {
      next.skipped = true;
      next.reason = "quiet_hours_dropped";
      return next;
    }
    next.fireAt = fireAt;
    // Keep overdue_nudge as the primary reason; substitution is implied.
    return next;
  });
}

export function coalescePast(
  items: PlannedNotification[],
  dueAt: Date,
  now: Date,
  settings: EngineSettings,
): PlannedNotification[] {
  const result = items.map(clone);
  const dueInFuture = dueAt.getTime() > now.getTime();

  const pastIndexes = result
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.skipped && item.origin !== "synthetic" && item.fireAt.getTime() < now.getTime());

  if (pastIndexes.length === 0) return result;

  if (!dueInFuture || settings.pastReminderPolicy === "skip") {
    for (const { index } of pastIndexes) {
      result[index].skipped = true;
      result[index].reason = "past_skipped";
    }
    return result;
  }

  // Keep the past reminder nearest the due date (latest fireAt) and fire it now;
  // the rest would otherwise spam the user as a burst of immediate notifications.
  pastIndexes.sort((a, b) => b.item.originalFireAt.getTime() - a.item.originalFireAt.getTime());
  const [keep, ...drop] = pastIndexes;

  result[keep.index].fireAt = new Date(now);
  result[keep.index].reason = "past_coalesced";
  for (const { index } of drop) {
    result[index].skipped = true;
    result[index].reason = "past_skipped";
  }

  return result;
}

function priority(item: PlannedNotification): number {
  if (item.origin === "manual") return 40;
  if (item.reason === "quiet_hours_substituted") return 30;
  if (item.origin === "default") return 20;
  return 10;
}

export function dedupe(
  items: PlannedNotification[],
  settings: EngineSettings,
): PlannedNotification[] {
  const windowMs = settings.dedupeWindowMinutes * 60_000;
  const result = items.map(clone);
  if (windowMs <= 0) return result;

  const live = result
    .map((item, index) => ({ item, index }))
    .filter(({ item }) => !item.skipped)
    .sort((a, b) => a.item.fireAt.getTime() - b.item.fireAt.getTime());

  const kept: { item: PlannedNotification; index: number }[] = [];

  for (const candidate of live) {
    const conflict = kept.find(
      (k) => Math.abs(k.item.fireAt.getTime() - candidate.item.fireAt.getTime()) < windowMs,
    );

    if (!conflict) {
      kept.push(candidate);
      continue;
    }

    const candidateWins =
      priority(candidate.item) > priority(conflict.item) ||
      (priority(candidate.item) === priority(conflict.item) &&
        candidate.item.originalFireAt.getTime() > conflict.item.originalFireAt.getTime());

    if (candidateWins) {
      result[conflict.index].skipped = true;
      result[conflict.index].reason = "deduped";
      kept.splice(kept.indexOf(conflict), 1, candidate);
    } else {
      result[candidate.index].skipped = true;
      result[candidate.index].reason = "deduped";
    }
  }

  return result;
}

export function makeOverdueNudge(
  dueAt: Date,
  now: Date,
  settings: EngineSettings,
): PlannedNotification | null {
  if (!settings.overdueNudgeEnabled) return null;

  let fireAt = new Date(dueAt.getTime() + settings.overdueNudgeDelayMinutes * 60_000);
  // An assignment created already overdue should still nudge, not sit in the past.
  if (fireAt.getTime() < now.getTime()) {
    fireAt = new Date(now);
  }

  return {
    ruleId: null,
    fireAt,
    originalFireAt: new Date(dueAt.getTime() + settings.overdueNudgeDelayMinutes * 60_000),
    reason: "overdue_nudge",
    origin: "synthetic",
    skipped: false,
    label: "Overdue nudge",
  };
}
