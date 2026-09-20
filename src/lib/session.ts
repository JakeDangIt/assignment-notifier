import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { extractEmail, extractUserId } from "@/lib/tenancy";

/** Signed-in Neon Auth user. `id` is the tenant key (never email). */
export type AppUser = {
  id: string;
  email: string | null;
};

export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export { extractEmail, extractUserId };

export async function getAppUser(): Promise<AppUser | null> {
  const { data: session } = await auth.getSession();
  const id = extractUserId(session);
  if (!id) return null;
  return { id, email: extractEmail(session) };
}

export async function requireAppUser(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) throw new HttpError(401, "Unauthorized");
  return user;
}

export async function requirePageUser(): Promise<AppUser> {
  const user = await getAppUser();
  if (!user) redirect("/auth/sign-in");
  return user;
}
