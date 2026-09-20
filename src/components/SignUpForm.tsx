"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button, Input, Label } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setPending(true);
    setError(null);

    try {
      const { error: signUpError } = await authClient.signUp.email({
        name: name.trim() || email.split("@")[0] || "Owner",
        email,
        password,
      });

      if (signUpError) {
        setError(signUpError.message || "Could not create the account");
        return;
      }

      router.replace("/");
      router.refresh();
    } catch {
      setError("Network error. Check your connection.");
    } finally {
      setPending(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div>
        <Label htmlFor="name">Name</Label>
        <Input
          id="name"
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Your name"
          autoComplete="name"
          autoFocus
        />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          required
          aria-invalid={Boolean(error)}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="At least 8 characters"
          autoComplete="new-password"
          minLength={8}
          required
          aria-invalid={Boolean(error)}
        />
      </div>

      {error ? (
        <p role="alert" className="text-sm text-danger">
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        className="w-full"
        disabled={pending || !email || password.length < 8}
      >
        {pending ? "Creating account…" : "Create account"}
      </Button>

      <p className="text-center text-sm text-ink-muted">
        Already have an account?{" "}
        <Link href="/auth/sign-in" className="text-ink underline-offset-2 hover:underline">
          Sign in
        </Link>
      </p>
    </form>
  );
}
