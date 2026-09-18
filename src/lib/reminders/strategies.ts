import { addLocalDays, atLocalTimeOnSameDay } from "@/lib/time";
import type { EngineSettings } from "./types";

/**
 * A substitution strategy relocates (or drops) a reminder whose raw fire time
 * landed inside quiet hours. Strategies are a registry so the engine pipeline
 * never switches on strategy names — adding a new behaviour is a new function
 * plus a registry entry, not an edit to the pipeline.
 */
export type SubstitutionContext = {
  fireAt: Date;
  dueAt: Date;
  settings: EngineSettings;
};

export type SubstitutionResult = {
  /** `null` means drop the reminder. */
  fireAt: Date | null;
};

export type SubstitutionStrategy = (ctx: SubstitutionContext) => SubstitutionResult;

/** 21:00 (or `substitutionTimeLocal`) on the local calendar day before `fireAt`. */
export const eveningBefore: SubstitutionStrategy = ({ fireAt, settings }) => ({
  fireAt: atLocalTimeOnSameDay(
    addLocalDays(fireAt, -1, settings.timezone),
    settings.substitutionTimeLocal,
    settings.timezone,
  ),
});

/**
 * Clamp forward to `quietEndLocal`. If that instant is still behind `fireAt`
 * (the window wraps midnight and we are in the evening half), use the next
 * local morning instead.
 *
 * Used for overdue nudges, where "last night" is the wrong direction.
 */
export const shiftToQuietEnd: SubstitutionStrategy = ({ fireAt, settings }) => {
  const sameDayEnd = atLocalTimeOnSameDay(
    fireAt,
    settings.quietEndLocal,
    settings.timezone,
  );
  if (sameDayEnd.getTime() > fireAt.getTime()) {
    return { fireAt: sameDayEnd };
  }

  return {
    fireAt: atLocalTimeOnSameDay(
      addLocalDays(fireAt, 1, settings.timezone),
      settings.quietEndLocal,
      settings.timezone,
    ),
  };
};

export const drop: SubstitutionStrategy = () => ({ fireAt: null });

export const SUBSTITUTION_STRATEGIES: Record<
  EngineSettings["substitutionStrategy"],
  SubstitutionStrategy
> = {
  evening_before: eveningBefore,
  shift_to_quiet_end: shiftToQuietEnd,
  drop,
};

export function getSubstitutionStrategy(
  name: EngineSettings["substitutionStrategy"],
): SubstitutionStrategy {
  const strategy = SUBSTITUTION_STRATEGIES[name];
  if (!strategy) {
    throw new Error(`Unknown substitution strategy "${name}"`);
  }
  return strategy;
}
