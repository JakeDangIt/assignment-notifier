import { resolveRule } from "./resolve";
import {
  applyOverdueQuietHours,
  applyQuietHours,
  coalescePast,
  dedupe,
  makeOverdueNudge,
} from "./transforms";
import type { ComputePlanInput, PlannedNotification } from "./types";

/**
 * Pure reminder planner. No I/O — given a due time, rules, settings and `now`,
 * returns the concrete fire instants (and the ones it skipped) so callers can
 * persist or preview them.
 *
 * Pipeline order is load-bearing:
 *  1. resolve each enabled rule to a raw instant
 *  2. relocate anything that landed in quiet hours
 *  3. inject the overdue nudge (forced forward-shift if *it* is in quiet hours)
 *  4. coalesce a burst of already-past reminders into a single immediate one
 *  5. drop duplicates that landed within the dedupe window
 */
export function computePlan(input: ComputePlanInput): PlannedNotification[] {
  const { dueAt, rules, settings, now } = input;

  const resolved = rules.filter((rule) => rule.enabled).map((rule) => resolveRule(rule, dueAt, settings));
  const afterQuiet = applyQuietHours(resolved, dueAt, settings);

  const overdue = makeOverdueNudge(dueAt, now, settings);
  const withOverdue = overdue
    ? [...afterQuiet, ...applyOverdueQuietHours([overdue], dueAt, settings)]
    : afterQuiet;

  const afterPast = coalescePast(withOverdue, dueAt, now, settings);
  return dedupe(afterPast, settings).sort((a, b) => a.fireAt.getTime() - b.fireAt.getTime());
}
