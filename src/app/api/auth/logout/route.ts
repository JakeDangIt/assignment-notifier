import { cookies } from "next/headers";
import { SESSION_COOKIE } from "@/lib/auth";
import { ok, route } from "@/lib/api";

export const POST = route(async () => {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  return ok({ ok: true });
});
