"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api-client";
import { formatWhen } from "@/lib/format";
import { RULE_PRESETS, describeRule } from "@/lib/reminders/presets";
import { Badge, Button, Input } from "@/components/ui";
import type { NotificationReason } from "@/lib/reminders/types";
import type { RuleInput } from "@/lib/assignments/service";

export type DraftRule = RuleInput & { key: string };

export type PlannedRow = {
  ruleId: string | null;
  fireAt: string;
  originalFireAt: string;
  reason: NotificationReason | null;
  origin: "default" | "manual" | "synthetic";
  skipped: boolean;
  label: string | null;
};

const REASON_COPY: Record<NotificationReason, string> = {
  quiet_hours_substituted: "Moved out of quiet hours",
  quiet_hours_dropped: "Dropped (quiet hours)",
  deduped: "Skipped — too close to another reminder",
  past_coalesced: "Fires now (was already in the past)",
  past_skipped: "Skipped — already in the past",
  overdue_nudge: "Overdue nudge",
};

export function ReminderEditor({
  timezone,
  dueAtLocal,
  rules,
  onChange,
}: {
  timezone: string;
  dueAtLocal: string;
  rules: DraftRule[];
  onChange: (rules: DraftRule[]) => void;
}) {
  const [planned, setPlanned] = useState<PlannedRow[]>([]);

  useEffect(() => {
    if (!dueAtLocal) return;
    let cancelled = false;

    const timer = setTimeout(() => {
      api<{ planned: PlannedRow[] }>("/api/reminders/preview", {
        method: "POST",
        body: JSON.stringify({ dueAtLocal, rules }),
      })
        .then((data) => {
          if (!cancelled) setPlanned(data.planned);
        })
        .catch(() => {
          if (!cancelled) setPlanned([]);
        });
    }, 250);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [dueAtLocal, rules]);

  const addPreset = (id: string) => {
    const preset = RULE_PRESETS.find((item) => item.id === id);
    if (!preset) return;

    const next: DraftRule =
      preset.spec.kind === "offset"
        ? {
            key: crypto.randomUUID(),
            kind: "offset",
            offsetMinutes: preset.spec.offsetMinutes,
            label: preset.label,
            origin: "manual",
            enabled: true,
          }
        : {
            key: crypto.randomUUID(),
            kind: "time_of_day",
            dayOffset: preset.spec.dayOffset,
            timeLocal: preset.spec.timeLocal,
            label: preset.label,
            origin: "manual",
            enabled: true,
          };

    onChange([...rules, next]);
  };

  const addCustom = () => {
    onChange([
      ...rules,
      {
        key: crypto.randomUUID(),
        kind: "absolute",
        absoluteAtLocal: dueAtLocal,
        label: "Custom time",
        origin: "manual",
        enabled: true,
      },
    ]);
  };

  const remove = (key: string) => onChange(rules.filter((rule) => rule.key !== key));

  const usedPresetIds = useMemo(() => {
    return new Set(
      rules.flatMap((rule) => {
        const match = RULE_PRESETS.find((preset) => {
          if (preset.spec.kind === "offset" && rule.kind === "offset") {
            return preset.spec.offsetMinutes === rule.offsetMinutes;
          }
          if (preset.spec.kind === "time_of_day" && rule.kind === "time_of_day") {
            return (
              preset.spec.dayOffset === rule.dayOffset &&
              preset.spec.timeLocal === (rule.timeLocal.length === 5 ? `${rule.timeLocal}:00` : rule.timeLocal)
            );
          }
          return false;
        });
        return match ? [match.id] : [];
      }),
    );
  }, [rules]);

  return (
    <section className="space-y-3">
      <div>
        <h2 className="text-base font-semibold">Reminders</h2>
        <p className="text-sm text-ink-muted">
          Times below are exact, after quiet-hours adjustments, in {timezone.replace(/_/g, " ")}.
        </p>
      </div>

      <ul className="space-y-2">
        {rules.map((rule) => (
          <li
            key={rule.key}
            className="flex items-start justify-between gap-3 rounded-2xl border border-border bg-surface px-3 py-3"
          >
            <div className="min-w-0">
              <p className="font-medium">{describeDraft(rule)}</p>
              {rule.kind === "absolute" ? (
                <Input
                  type="datetime-local"
                  className="mt-2"
                  value={rule.absoluteAtLocal}
                  onChange={(event) =>
                    onChange(
                      rules.map((item) =>
                        item.key === rule.key && item.kind === "absolute"
                          ? { ...item, absoluteAtLocal: event.target.value }
                          : item,
                      ),
                    )
                  }
                />
              ) : null}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={() => remove(rule.key)}>
              Remove
            </Button>
          </li>
        ))}
      </ul>

      <div className="flex flex-wrap gap-2">
        {RULE_PRESETS.map((preset) => (
          <Button
            key={preset.id}
            type="button"
            variant="secondary"
            size="sm"
            disabled={usedPresetIds.has(preset.id)}
            onClick={() => addPreset(preset.id)}
          >
            {preset.label}
          </Button>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addCustom}>
          Custom time
        </Button>
      </div>

      <div className="rounded-2xl border border-border bg-canvas p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
          Will fire at
        </p>
        {planned.length === 0 ? (
          <p className="text-sm text-ink-muted">No reminders scheduled.</p>
        ) : (
          <ul className="space-y-2">
            {planned.map((item, index) => (
              <li key={`${item.ruleId}-${index}`} className="flex items-start justify-between gap-3">
                <div>
                  <p className={item.skipped ? "text-sm text-ink-subtle line-through" : "text-sm"}>
                    {item.label ?? "Reminder"}
                  </p>
                  <p className={item.skipped ? "text-xs text-ink-subtle" : "text-xs text-ink-muted"}>
                    {formatWhen(item.fireAt, timezone)}
                    {item.reason === "quiet_hours_substituted"
                      ? ` (was ${formatWhen(item.originalFireAt, timezone)})`
                      : ""}
                  </p>
                </div>
                {item.reason ? (
                  <Badge tone={item.skipped ? "neutral" : item.reason === "quiet_hours_substituted" ? "warning" : "accent"}>
                    {REASON_COPY[item.reason]}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

export function describeDraft(rule: DraftRule): string {
  if (rule.kind === "absolute") return rule.label ?? "Custom time";
  return describeRule({
    kind: rule.kind,
    offsetMinutes: rule.kind === "offset" ? rule.offsetMinutes : null,
    dayOffset: rule.kind === "time_of_day" ? rule.dayOffset : null,
    timeLocal: rule.kind === "time_of_day" ? rule.timeLocal : null,
    label: rule.label ?? null,
  });
}

export function rulesToPayload(rules: DraftRule[]): RuleInput[] {
  return rules.map(({ key, ...rule }) => {
    void key;
    return rule;
  });
}
