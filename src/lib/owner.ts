/**
 * Single-tenant gate: a Neon session is not enough. Only OWNER_EMAIL may use
 * assignment data. Comparison is case-insensitive and trims whitespace.
 *
 * Kept free of Neon SDK imports so unit tests and Edge middleware can share it.
 */

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  const owner = process.env.OWNER_EMAIL;
  if (!email || !owner) return false;
  return normalizeEmail(email) === normalizeEmail(owner);
}
