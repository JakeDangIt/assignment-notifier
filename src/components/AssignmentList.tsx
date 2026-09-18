"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { groupAssignments, LIST_GROUP_LABELS, type ListGroupId } from "@/lib/assignments/group";
import { api, type AssignmentDTO } from "@/lib/api-client";
import { formatDue } from "@/lib/format";
import { Badge, Button } from "@/components/ui";
import { cn } from "@/lib/utils";

const ORDER: ListGroupId[] = ["overdue", "today", "week", "later", "completed"];

export function AssignmentList({
  initial,
  timezone,
}: {
  initial: AssignmentDTO[];
  timezone: string;
}) {
  const [items, setItems] = useState(initial);
  const [busyId, setBusyId] = useState<string | null>(null);

  const groups = useMemo(() => {
    const now = new Date();
    return groupAssignments(
      items.map((item) => ({
        dto: item,
        id: item.id,
        dueAt: new Date(item.dueAt),
        completedAt: item.completedAt ? new Date(item.completedAt) : null,
      })),
      now,
      timezone,
    );
  }, [items, timezone]);

  const toggleComplete = async (item: AssignmentDTO) => {
    setBusyId(item.id);
    const path = item.completedAt
      ? `/api/assignments/${item.id}/uncomplete`
      : `/api/assignments/${item.id}/complete`;

    try {
      const { assignment } = await api<{ assignment: AssignmentDTO }>(path, { method: "POST" });
      setItems((current) => current.map((row) => (row.id === item.id ? assignment : row)));
    } finally {
      setBusyId(null);
    }
  };

  const empty = items.length === 0;

  return (
    <div className="space-y-6">
      {empty ? (
        <p className="rounded-2xl border border-dashed border-border px-4 py-10 text-center text-sm text-ink-muted">
          No assignments yet. Add one and reminders will attach automatically.
        </p>
      ) : null}

      {ORDER.map((id) => {
        const rows = groups[id];
        if (rows.length === 0) return null;

        return (
          <section key={id}>
            <h2
              className={cn(
                "mb-2 text-xs font-semibold uppercase tracking-wider",
                id === "overdue" ? "text-danger" : "text-ink-subtle",
              )}
            >
              {LIST_GROUP_LABELS[id]}
            </h2>
            <ul className="space-y-2">
              {rows.map((item) => (
                <AssignmentRow
                  key={item.id}
                  item={item.dto}
                  timezone={timezone}
                  busy={busyId === item.id}
                  onToggle={() => toggleComplete(item.dto)}
                />
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function AssignmentRow({
  item,
  timezone,
  busy,
  onToggle,
}: {
  item: AssignmentDTO;
  timezone: string;
  busy: boolean;
  onToggle: () => void;
}) {
  const overdue = !item.completedAt && new Date(item.dueAt).getTime() < Date.now();

  return (
    <li className="flex items-stretch gap-2 rounded-2xl border border-border bg-surface">
      <button
        type="button"
        aria-label={item.completedAt ? "Mark incomplete" : "Mark complete"}
        disabled={busy}
        onClick={onToggle}
        className="flex w-12 shrink-0 items-center justify-center text-ink-muted hover:text-success"
      >
        <span
          className={cn(
            "flex size-6 items-center justify-center rounded-full border",
            item.completedAt
              ? "border-success bg-success text-canvas"
              : overdue
                ? "border-danger"
                : "border-border-strong",
          )}
        >
          {item.completedAt ? "✓" : ""}
        </span>
      </button>

      <Link href={`/assignments/${item.id}`} className="min-w-0 flex-1 py-3 pr-3">
        <div className="flex items-start justify-between gap-2">
          <p className={cn("font-medium", item.completedAt && "text-ink-muted line-through")}>
            {item.title}
          </p>
          {item.className ? (
            <Badge tone="accent" className="shrink-0">
              {item.className}
            </Badge>
          ) : null}
        </div>
        <p className={cn("mt-0.5 text-sm", overdue ? "text-danger" : "text-ink-muted")}>
          {formatDue(item.dueAt, timezone)}
        </p>
      </Link>
    </li>
  );
}

export function NewAssignmentButton() {
  const router = useRouter();
  return (
    <Button size="sm" onClick={() => router.push("/new")}>
      New
    </Button>
  );
}

export function AssignmentFab() {
  return (
    <Link
      href="/new"
      className="fixed right-4 z-30 flex size-14 items-center justify-center rounded-full bg-accent-strong text-2xl text-white shadow-lg shadow-black/40"
      style={{ bottom: "calc(env(safe-area-inset-bottom) + 5.5rem)" }}
      aria-label="New assignment"
    >
      +
    </Link>
  );
}
