export type AssignmentDTO = {
  id: string;
  title: string;
  description: string | null;
  className: string | null;
  dueAt: string;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SettingsPublic = {
  timezone: string;
  quietEnabled: boolean;
  quietStartLocal: string;
  quietEndLocal: string;
  substitutionStrategy: "evening_before" | "shift_to_quiet_end" | "drop";
  substitutionTimeLocal: string;
  allowDueTimeInQuiet: boolean;
  dedupeWindowMinutes: number;
  pastReminderPolicy: "fire_now" | "skip";
  overdueNudgeEnabled: boolean;
  overdueNudgeDelayMinutes: number;
};

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function api<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new ApiError(data.error ?? "Request failed", response.status);
  }
  return data as T;
}
