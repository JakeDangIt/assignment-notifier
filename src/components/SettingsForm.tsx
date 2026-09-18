"use client";

import { useMemo, useState } from "react";
import { api, ApiError, type SettingsPublic } from "@/lib/api-client";
import { RULE_PRESETS, describeRule } from "@/lib/reminders/presets";
import { Button, Field, Input, Select } from "@/components/ui";
import type { DraftRule } from "@/components/ReminderEditor";

const TIMEZONES = collectTimeZones();

type DefaultRule = {
  kind: "offset" | "time_of_day";
  offsetMinutes: number | null;
  dayOffset: number | null;
  timeLocal: string | null;
  label: string | null;
  enabled: boolean;
};

export function SettingsForm({
  initialSettings,
  initialDefaults,
}: {
  initialSettings: SettingsPublic;
  initialDefaults: DefaultRule[];
}) {
  const [form, setForm] = useState(initialSettings);
  const [defaults, setDefaults] = useState<DraftRule[]>(() =>
    initialDefaults.map((rule, index) =>
      rule.kind === "offset"
        ? {
            key: `d-${index}`,
            kind: "offset" as const,
            offsetMinutes: rule.offsetMinutes ?? 0,
            label: rule.label,
            origin: "default" as const,
            enabled: rule.enabled,
          }
        : {
            key: `d-${index}`,
            kind: "time_of_day" as const,
            dayOffset: rule.dayOffset ?? 0,
            timeLocal: rule.timeLocal ?? "09:00:00",
            label: rule.label,
            origin: "default" as const,
            enabled: rule.enabled,
          },
    ),
  );
  const [pending, setPending] = useState<"settings" | "defaults" | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const set = <K extends keyof SettingsPublic>(key: K, value: SettingsPublic[K]) =>
    setForm((current) => ({ ...current, [key]: value }));

  const saveSettings = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("settings");
    setError(null);
    setMessage(null);
    try {
      await api("/api/settings", { method: "PUT", body: JSON.stringify(form) });
      setMessage("Settings saved. Future reminders were replanned.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save settings");
    } finally {
      setPending(null);
    }
  };

  const saveDefaults = async () => {
    setPending("defaults");
    setError(null);
    setMessage(null);
    try {
      await api("/api/defaults", {
        method: "PUT",
        body: JSON.stringify({
          rules: defaults
            .filter((rule) => rule.kind !== "absolute")
            .map((rule) =>
              rule.kind === "offset"
                ? { kind: "offset", offsetMinutes: rule.offsetMinutes, label: rule.label, enabled: true }
                : {
                    kind: "time_of_day",
                    dayOffset: rule.dayOffset,
                    timeLocal: rule.timeLocal,
                    label: rule.label,
                    enabled: true,
                  },
            ),
        }),
      });
      setMessage("Default reminder set saved. New assignments will use it.");
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save defaults");
    } finally {
      setPending(null);
    }
  };

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
            origin: "default",
            enabled: true,
          }
        : {
            key: crypto.randomUUID(),
            kind: "time_of_day",
            dayOffset: preset.spec.dayOffset,
            timeLocal: preset.spec.timeLocal,
            label: preset.label,
            origin: "default",
            enabled: true,
          };
    setDefaults((current) => [...current, next]);
  };

  const used = useMemo(
    () =>
      new Set(
        defaults.flatMap((rule) => {
          const match = RULE_PRESETS.find((preset) => {
            if (preset.spec.kind === "offset" && rule.kind === "offset") {
              return preset.spec.offsetMinutes === rule.offsetMinutes;
            }
            if (preset.spec.kind === "time_of_day" && rule.kind === "time_of_day") {
              return preset.spec.dayOffset === rule.dayOffset;
            }
            return false;
          });
          return match ? [match.id] : [];
        }),
      ),
    [defaults],
  );

  return (
    <div className="space-y-8">
      <form onSubmit={saveSettings} className="space-y-4">
        <h2 className="text-base font-semibold">Schedule</h2>
        <Field label="Timezone">
          <Select value={form.timezone} onChange={(e) => set("timezone", e.target.value)}>
            {TIMEZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone.replace(/_/g, " ")}
              </option>
            ))}
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.quietEnabled}
            onChange={(e) => set("quietEnabled", e.target.checked)}
          />
          Enable quiet hours
        </label>

        <div className="grid grid-cols-2 gap-3">
          <Field label="Quiet start">
            <Input
              type="time"
              value={trimSeconds(form.quietStartLocal)}
              onChange={(e) => set("quietStartLocal", e.target.value)}
            />
          </Field>
          <Field label="Quiet end">
            <Input
              type="time"
              value={trimSeconds(form.quietEndLocal)}
              onChange={(e) => set("quietEndLocal", e.target.value)}
            />
          </Field>
        </div>

        <Field label="If a reminder lands in quiet hours">
          <Select
            value={form.substitutionStrategy}
            onChange={(e) =>
              set("substitutionStrategy", e.target.value as SettingsPublic["substitutionStrategy"])
            }
          >
            <option value="evening_before">Move to the evening before</option>
            <option value="shift_to_quiet_end">Shift to when quiet hours end</option>
            <option value="drop">Skip the reminder</option>
          </Select>
        </Field>

        {form.substitutionStrategy === "evening_before" ? (
          <Field label="Evening-before time">
            <Input
              type="time"
              value={trimSeconds(form.substitutionTimeLocal)}
              onChange={(e) => set("substitutionTimeLocal", e.target.value)}
            />
          </Field>
        ) : null}

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.allowDueTimeInQuiet}
            onChange={(e) => set("allowDueTimeInQuiet", e.target.checked)}
          />
          Allow an “at due time” reminder during quiet hours
        </label>

        <Field label="Dedupe window (minutes)">
          <Input
            type="number"
            min={0}
            value={form.dedupeWindowMinutes}
            onChange={(e) => set("dedupeWindowMinutes", Number(e.target.value))}
          />
        </Field>

        <Field label="Past reminders on a still-upcoming assignment">
          <Select
            value={form.pastReminderPolicy}
            onChange={(e) =>
              set("pastReminderPolicy", e.target.value as SettingsPublic["pastReminderPolicy"])
            }
          >
            <option value="fire_now">Fire one immediately</option>
            <option value="skip">Skip them</option>
          </Select>
        </Field>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={form.overdueNudgeEnabled}
            onChange={(e) => set("overdueNudgeEnabled", e.target.checked)}
          />
          Send an overdue nudge
        </label>

        {form.overdueNudgeEnabled ? (
          <Field label="Overdue nudge delay (minutes after due)">
            <Input
              type="number"
              min={0}
              value={form.overdueNudgeDelayMinutes}
              onChange={(e) => set("overdueNudgeDelayMinutes", Number(e.target.value))}
            />
          </Field>
        ) : null}

        <Button type="submit" className="w-full" disabled={pending !== null}>
          {pending === "settings" ? "Saving…" : "Save schedule settings"}
        </Button>
      </form>

      <section className="space-y-3">
        <h2 className="text-base font-semibold">Default reminders</h2>
        <p className="text-sm text-ink-muted">
          Applied to every new assignment. Existing assignments keep their own set.
        </p>
        <ul className="space-y-2">
          {defaults.map((rule) => (
            <li
              key={rule.key}
              className="flex items-center justify-between rounded-2xl border border-border bg-surface px-3 py-2"
            >
              <span className="text-sm">
                {describeRule({
                  kind: rule.kind,
                  offsetMinutes: rule.kind === "offset" ? rule.offsetMinutes : null,
                  dayOffset: rule.kind === "time_of_day" ? rule.dayOffset : null,
                  timeLocal: rule.kind === "time_of_day" ? rule.timeLocal : null,
                  label: rule.label ?? null,
                })}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDefaults((current) => current.filter((item) => item.key !== rule.key))}
              >
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
              disabled={used.has(preset.id)}
              onClick={() => addPreset(preset.id)}
            >
              {preset.label}
            </Button>
          ))}
        </div>
        <Button
          type="button"
          className="w-full"
          variant="secondary"
          disabled={pending !== null}
          onClick={saveDefaults}
        >
          {pending === "defaults" ? "Saving…" : "Save default set"}
        </Button>
      </section>

      {message ? <p className="text-sm text-success">{message}</p> : null}
      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function trimSeconds(value: string): string {
  return value.slice(0, 5);
}

function collectTimeZones(): string[] {
  const supported =
    typeof Intl !== "undefined" && "supportedValuesOf" in Intl
      ? Intl.supportedValuesOf("timeZone")
      : ["America/New_York", "America/Chicago", "America/Denver", "America/Los_Angeles", "UTC"];

  const preferred = [
    "America/New_York",
    "America/Chicago",
    "America/Denver",
    "America/Los_Angeles",
    "America/Phoenix",
    "Pacific/Honolulu",
    "UTC",
  ];
  return [...preferred, ...supported.filter((zone) => !preferred.includes(zone))];
}
