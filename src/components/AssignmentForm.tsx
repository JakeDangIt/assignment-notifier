"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { api, ApiError, type AssignmentDTO } from "@/lib/api-client";
import { Button, Field, Input, Textarea } from "@/components/ui";
import { addLocalDays, atLocalTimeOnSameDay, formatLocalDateTime } from "@/lib/time";
import { ReminderEditor, rulesToPayload, type DraftRule } from "@/components/ReminderEditor";

type InitialRule = {
  kind: "offset" | "time_of_day" | "absolute";
  offsetMinutes: number | null;
  dayOffset: number | null;
  timeLocal: string | null;
  absoluteAt: string | null;
  label: string | null;
  origin: "default" | "manual";
  enabled: boolean;
};

export function AssignmentForm({
  timezone,
  assignment,
  initialRules,
}: {
  timezone: string;
  assignment?: AssignmentDTO;
  initialRules?: InitialRule[];
}) {
  const router = useRouter();
  const editing = Boolean(assignment);

  const [title, setTitle] = useState(assignment?.title ?? "");
  const [className, setClassName] = useState(assignment?.className ?? "");
  const [description, setDescription] = useState(assignment?.description ?? "");
  const [dueAtLocal, setDueAtLocal] = useState(
    assignment
      ? formatLocalDateTime(new Date(assignment.dueAt), timezone)
      : defaultDue(timezone),
  );
  const [rules, setRules] = useState<DraftRule[]>(() =>
    initialRules ? initialRules.map((rule) => fromStored(rule, timezone)) : [],
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<"save" | "delete" | "complete" | null>(null);

  useEffect(() => {
    if (editing || initialRules) return;

    let cancelled = false;
    api<{
      rules: Array<{
        kind: "offset" | "time_of_day";
        offsetMinutes: number | null;
        dayOffset: number | null;
        timeLocal: string | null;
        label: string | null;
        origin?: "default" | "manual";
        enabled: boolean;
      }>;
    }>("/api/defaults")
      .then((data) => {
        if (cancelled) return;
        setRules(
          data.rules.map((rule) =>
            fromStored(
              {
                ...rule,
                absoluteAt: null,
                origin: "default",
              },
              timezone,
            ),
          ),
        );
      })
      .catch(() => {
        /* defaults are optional; the form still works without them */
      });

    return () => {
      cancelled = true;
    };
  }, [editing, initialRules, timezone]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending("save");
    setError(null);

    try {
      const body = JSON.stringify({
        title,
        className: className || null,
        description: description || null,
        dueAtLocal,
        rules: rulesToPayload(rules),
      });

      if (editing && assignment) {
        await api(`/api/assignments/${assignment.id}`, { method: "PATCH", body });
        router.push(`/assignments/${assignment.id}`);
      } else {
        const { assignment: created } = await api<{ assignment: AssignmentDTO }>(
          "/api/assignments",
          { method: "POST", body },
        );
        router.push(`/assignments/${created.id}`);
      }
      router.refresh();
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Could not save");
    } finally {
      setPending(null);
    }
  };

  const complete = async () => {
    if (!assignment) return;
    setPending("complete");
    const path = assignment.completedAt
      ? `/api/assignments/${assignment.id}/uncomplete`
      : `/api/assignments/${assignment.id}/complete`;
    await api(path, { method: "POST" });
    router.refresh();
    setPending(null);
  };

  const remove = async () => {
    if (!assignment) return;
    if (!window.confirm("Delete this assignment? Remaining reminders will be canceled.")) return;
    setPending("delete");
    await api(`/api/assignments/${assignment.id}`, { method: "DELETE" });
    router.push("/");
    router.refresh();
  };

  return (
    <form onSubmit={save} className="space-y-4">
      <Field label="Title">
        <Input value={title} onChange={(e) => setTitle(e.target.value)} required maxLength={200} />
      </Field>
      <Field label="Class" hint="Optional">
        <Input value={className} onChange={(e) => setClassName(e.target.value)} maxLength={120} />
      </Field>
      <Field label="Due date & time">
        <Input
          type="datetime-local"
          value={dueAtLocal}
          onChange={(e) => setDueAtLocal(e.target.value)}
          required
        />
      </Field>
      <Field label="Notes" hint="Optional">
        <Textarea
          rows={3}
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          maxLength={4000}
        />
      </Field>

      <ReminderEditor timezone={timezone} dueAtLocal={dueAtLocal} rules={rules} onChange={setRules} />

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending !== null || !title.trim()}>
        {pending === "save" ? "Saving…" : editing ? "Save changes" : "Create assignment"}
      </Button>

      {editing && assignment ? (
        <div className="flex gap-2">
          <Button
            type="button"
            variant="secondary"
            className="flex-1"
            disabled={pending !== null}
            onClick={complete}
          >
            {assignment.completedAt ? "Mark incomplete" : "Mark complete"}
          </Button>
          <Button type="button" variant="danger" disabled={pending !== null} onClick={remove}>
            Delete
          </Button>
        </div>
      ) : null}
    </form>
  );
}

function defaultDue(timezone: string): string {
  const tomorrow = addLocalDays(new Date(), 1, timezone);
  return formatLocalDateTime(atLocalTimeOnSameDay(tomorrow, "09:00:00", timezone), timezone);
}

function fromStored(rule: InitialRule, timezone: string): DraftRule {
  const key = crypto.randomUUID();
  if (rule.kind === "offset") {
    return {
      key,
      kind: "offset",
      offsetMinutes: rule.offsetMinutes ?? 0,
      label: rule.label,
      origin: rule.origin,
      enabled: rule.enabled,
    };
  }
  if (rule.kind === "time_of_day") {
    return {
      key,
      kind: "time_of_day",
      dayOffset: rule.dayOffset ?? 0,
      timeLocal: rule.timeLocal ?? "09:00:00",
      label: rule.label,
      origin: rule.origin,
      enabled: rule.enabled,
    };
  }
  return {
    key,
    kind: "absolute",
    absoluteAtLocal: rule.absoluteAt
      ? formatLocalDateTime(new Date(rule.absoluteAt), timezone)
      : defaultDue(timezone),
    label: rule.label,
    origin: rule.origin,
    enabled: rule.enabled,
  };
}
