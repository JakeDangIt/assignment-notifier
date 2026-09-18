"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api-client";
import { formatWhen } from "@/lib/format";
import { Badge, Button, Card } from "@/components/ui";

type LogRow = {
  id: string;
  assignmentId: string;
  assignmentTitle: string | null;
  fireAt: string;
  originalFireAt: string | null;
  status: string;
  reason: string | null;
  attempts: number;
  lastError: string | null;
  sentAt: string | null;
};

const TONE: Record<string, "neutral" | "accent" | "success" | "warning" | "danger"> = {
  pending: "neutral",
  enqueued: "accent",
  sending: "accent",
  sent: "success",
  failed: "danger",
  canceled: "neutral",
  skipped: "neutral",
};

export function DeliveryLog({
  initial,
  timezone,
}: {
  initial: LogRow[];
  timezone: string;
}) {
  const [rows, setRows] = useState(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [tickMessage, setTickMessage] = useState<string | null>(null);

  const grouped = useMemo(() => {
    const order = ["failed", "pending", "enqueued", "sending", "sent", "canceled", "skipped"];
    return order
      .map((status) => ({ status, items: rows.filter((row) => row.status === status) }))
      .filter((group) => group.items.length > 0);
  }, [rows]);

  const refresh = async () => {
    const data = await api<{ notifications: LogRow[] }>("/api/notifications");
    setRows(data.notifications);
  };

  const sendNow = async (id: string) => {
    setBusy(id);
    try {
      await api(`/api/notifications/${id}/send`, { method: "POST" });
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  const runTick = async () => {
    setBusy("tick");
    setTickMessage(null);
    try {
      const result = await api<{
        materialized: number;
        swept: { due: number; sent: number; failed: number };
      }>("/api/qstash/tick", { method: "POST", body: "{}" });
      setTickMessage(
        `Enqueued ${result.materialized}. Swept ${result.swept.due} due (${result.swept.sent} sent).`,
      );
      await refresh();
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm text-ink-muted">Newest first, last 200 rows.</p>
        <Button size="sm" variant="secondary" disabled={busy !== null} onClick={runTick}>
          {busy === "tick" ? "Running…" : "Run tick"}
        </Button>
      </div>
      {tickMessage ? <p className="text-sm text-success">{tickMessage}</p> : null}

      {grouped.length === 0 ? (
        <Card>
          <p className="text-sm text-ink-muted">No scheduled notifications yet.</p>
        </Card>
      ) : null}

      {grouped.map((group) => (
        <section key={group.status}>
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wider text-ink-subtle">
            {group.status}
          </h2>
          <ul className="space-y-2">
            {group.items.map((row) => (
              <li key={row.id} className="rounded-2xl border border-border bg-surface p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link href={`/assignments/${row.assignmentId}`} className="min-w-0 font-medium">
                    {row.assignmentTitle ?? "Deleted assignment"}
                  </Link>
                  <Badge tone={TONE[row.status] ?? "neutral"}>{row.status}</Badge>
                </div>
                <p className="mt-1 text-sm text-ink-muted">{formatWhen(row.fireAt, timezone)}</p>
                {row.reason ? (
                  <p className="mt-1 text-xs text-ink-subtle">{row.reason.replace(/_/g, " ")}</p>
                ) : null}
                {row.lastError ? <p className="mt-1 text-xs text-danger">{row.lastError}</p> : null}
                {(row.status === "pending" || row.status === "enqueued" || row.status === "failed") && (
                  <Button
                    className="mt-2"
                    size="sm"
                    variant="secondary"
                    disabled={busy !== null}
                    onClick={() => sendNow(row.id)}
                  >
                    {busy === row.id ? "Sending…" : "Send now"}
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
