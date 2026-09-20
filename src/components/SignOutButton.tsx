"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

export function SignOutButton() {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  return (
    <Button
      variant="ghost"
      size="sm"
      disabled={pending}
      onClick={async () => {
        setPending(true);
        try {
          await authClient.signOut();
        } finally {
          router.replace("/auth/sign-in");
          router.refresh();
        }
      }}
    >
      Sign out
    </Button>
  );
}
