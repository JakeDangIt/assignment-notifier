import { describe, expect, it } from "vitest";
import { assertUserId, extractEmail, extractUserId, parseMigrateToUserId } from "@/lib/tenancy";
import { starterDefaultRuleValues } from "@/lib/reminders/presets";

describe("extractUserId", () => {
  it("prefers Neon Auth user.id over email", () => {
    expect(
      extractUserId({
        user: { id: "user_abc", email: "jake@example.com" },
      }),
    ).toBe("user_abc");
  });

  it("falls back to session.userId when user.id is missing", () => {
    expect(
      extractUserId({
        user: { email: "jake@example.com" },
        session: { userId: "session-user" },
      }),
    ).toBe("session-user");
  });

  it("never treats email as the tenant key", () => {
    expect(extractUserId({ user: { email: "jake@example.com" } })).toBeNull();
    expect(extractUserId({ user: { id: "  ", email: "jake@example.com" } })).toBeNull();
    expect(extractUserId(null)).toBeNull();
    expect(extractUserId(undefined)).toBeNull();
  });
});

describe("extractEmail", () => {
  it("returns a trimmed email when present", () => {
    expect(extractEmail({ user: { id: "u1", email: "  Jake@Example.com " } })).toBe(
      "Jake@Example.com",
    );
  });

  it("returns null when email is missing", () => {
    expect(extractEmail({ user: { id: "u1" } })).toBeNull();
  });
});

describe("parseMigrateToUserId", () => {
  it("returns a trimmed id when set", () => {
    expect(parseMigrateToUserId({ MIGRATE_TO_USER_ID: "  user_abc  " })).toBe("user_abc");
  });

  it("returns null when unset or blank so orphans stay unused", () => {
    expect(parseMigrateToUserId({})).toBeNull();
    expect(parseMigrateToUserId({ MIGRATE_TO_USER_ID: "   " })).toBeNull();
  });
});

describe("assertUserId", () => {
  it("rejects a blank tenant key so queries cannot match every NULL user_id", () => {
    expect(() => assertUserId("")).toThrow(/userId is required/);
    expect(() => assertUserId("   ")).toThrow(/userId is required/);
  });

  it("returns the trimmed id", () => {
    expect(assertUserId(" user_abc ")).toBe("user_abc");
  });
});

describe("starterDefaultRuleValues", () => {
  it("tags starter defaults with the owning user id", () => {
    const rows = starterDefaultRuleValues("user_abc");
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((row) => row.userId === "user_abc")).toBe(true);
    expect(rows.map((row) => row.label)).toEqual([
      "1 day before",
      "3 hours before",
      "1 hour before",
    ]);
  });
});
