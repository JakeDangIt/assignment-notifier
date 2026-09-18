import { AppShell } from "@/components/AppShell";
import { InstallStatus } from "@/components/InstallStatus";
import { NotificationSetup } from "@/components/NotificationSetup";
import { PwaDiagnostics } from "@/components/PwaDiagnostics";

export const metadata = { title: "Settings" };

export default function SettingsPage() {
  return (
    <AppShell title="Settings" subtitle="Install, notifications, and later your reminder defaults.">
      <div className="space-y-4">
        <InstallStatus />
        <NotificationSetup />
        <PwaDiagnostics />
      </div>
    </AppShell>
  );
}
