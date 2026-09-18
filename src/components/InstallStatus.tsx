"use client";

import { useEffect, useState } from "react";
import { usePwaStatus } from "@/hooks/usePwaStatus";
import { Badge, Button, Card, CardTitle } from "@/components/ui";
import { MIN_IOS_PUSH_VERSION } from "@/lib/pwa";

/** Chrome's install prompt event, which isn't in the DOM lib types. */
type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const IOS_STEPS = [
  'Tap the Share button (the square with an arrow) in Safari\u2019s toolbar.',
  'Scroll down and tap "Add to Home Screen".',
  'Tap "Add", then open the app from your Home Screen icon.',
];

/**
 * Explains the app's install state and, on iOS, why installing is mandatory.
 *
 * This is the first thing on the home screen during setup because on iOS an
 * uninstalled PWA cannot subscribe to push at all -- the API throws rather than
 * degrading, so a plain "enable notifications" button would just look broken.
 */
export function InstallStatus() {
  const status = usePwaStatus();
  const [installPrompt, setInstallPrompt] = useState<BeforeInstallPromptEvent | null>(null);

  useEffect(() => {
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setInstallPrompt(event as BeforeInstallPromptEvent);
    };

    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!status.ready) {
    return (
      <Card>
        <div className="h-5 w-32 animate-pulse rounded bg-surface-raised" />
      </Card>
    );
  }

  if (status.isStandalone) {
    return (
      <Card className="border-success/30">
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>App installed</CardTitle>
            <p className="mt-1 text-sm text-ink-muted">
              Running as a standalone app, so push notifications can be delivered.
            </p>
          </div>
          <Badge tone="success">Standalone</Badge>
        </div>
      </Card>
    );
  }

  if (status.blocker === "ios-too-old") {
    return (
      <Card className="border-danger/30">
        <CardTitle>iOS update required</CardTitle>
        <p className="mt-1 text-sm text-ink-muted">
          Web push needs iOS {MIN_IOS_PUSH_VERSION.major}.{MIN_IOS_PUSH_VERSION.minor} or
          newer. This device reports iOS {status.iosVersion?.major}.{status.iosVersion?.minor}.
        </p>
      </Card>
    );
  }

  if (status.platform === "ios") {
    return (
      <Card className="border-warning/30">
        <div className="flex items-start justify-between gap-3">
          <CardTitle>Install to get notifications</CardTitle>
          <Badge tone="warning">Action needed</Badge>
        </div>
        <p className="mt-1 text-sm text-ink-muted">
          On iPhone, notifications only work once the app lives on your Home Screen.
        </p>
        <ol className="mt-3 space-y-2">
          {IOS_STEPS.map((step, index) => (
            <li key={step} className="flex gap-3 text-sm text-ink">
              <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-semibold text-indigo-200">
                {index + 1}
              </span>
              {step}
            </li>
          ))}
        </ol>
      </Card>
    );
  }

  return (
    <Card className="border-warning/30">
      <div className="flex items-start justify-between gap-3">
        <CardTitle>Install the app</CardTitle>
        <Badge tone="warning">Not installed</Badge>
      </div>
      <p className="mt-1 text-sm text-ink-muted">
        Installing keeps reminders working when the browser is closed.
      </p>
      {installPrompt ? (
        <Button
          className="mt-3"
          onClick={async () => {
            await installPrompt.prompt();
            setInstallPrompt(null);
          }}
        >
          Add to Home Screen
        </Button>
      ) : (
        <p className="mt-3 text-sm text-ink-subtle">
          Use your browser menu and choose &ldquo;Install app&rdquo; or &ldquo;Add to Home
          Screen&rdquo;.
        </p>
      )}
    </Card>
  );
}
