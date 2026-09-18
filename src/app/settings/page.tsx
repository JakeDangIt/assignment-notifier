import { AppShell } from "@/components/AppShell";
import { InstallStatus } from "@/components/InstallStatus";
import { NotificationSetup } from "@/components/NotificationSetup";
import { PwaDiagnostics } from "@/components/PwaDiagnostics";
import { SettingsForm } from "@/components/SettingsForm";
import { db, defaultReminderRules } from "@/lib/db";
import { getSettings, serializeSettings } from "@/lib/settings";
import { describeRule } from "@/lib/reminders/presets";

export const dynamic = "force-dynamic";
export const metadata = { title: "Settings" };

export default async function SettingsPage() {
  const settings = await getSettings();
  const defaults = await db.select().from(defaultReminderRules).orderBy(defaultReminderRules.sortOrder);

  return (
    <AppShell title="Settings" subtitle="Quiet hours, defaults, install, and notifications.">
      <div className="space-y-6">
        <SettingsForm
          initialSettings={serializeSettings(settings)}
          initialDefaults={defaults.map((row) => ({
            kind: row.kind === "time_of_day" ? "time_of_day" : "offset",
            offsetMinutes: row.offsetMinutes,
            dayOffset: row.dayOffset,
            timeLocal: row.timeLocal,
            label: row.label ?? describeRule(row),
            enabled: row.enabled,
          }))}
        />
        <InstallStatus />
        <NotificationSetup />
        <PwaDiagnostics />
      </div>
    </AppShell>
  );
}
