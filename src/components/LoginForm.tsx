"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Button, Input } from "@/components/ui";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [passcode, setPasscode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        setError(data.error ?? "Sign in failed");
        return;
      }

      // `refresh` clears the router cache so the redirect lands on live,
      // authenticated content rather than a cached login redirect.
      const next = searchParams.get("next");
      router.replace(next && next.startsWith("/") ? next : "/");
      router.refresh();
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <Input
        type="password"
        value={passcode}
        onChange={(event) => setPasscode(event.target.value)}
        placeholder="Passcode"
        autoComplete="current-password"
        // Numeric keypad suits a digit passcode without forbidding letters.
        inputMode="numeric"
        autoFocus
        required
        aria-invalid={Boolean(error)}
      />

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button type="submit" className="w-full" disabled={pending || !passcode}>
        {pending ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
