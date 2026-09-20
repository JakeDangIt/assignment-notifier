import { afterEach, describe, expect, it } from "vitest";
import { isOwnerEmail, normalizeEmail } from "@/lib/owner";

const originalOwner = process.env.OWNER_EMAIL;

afterEach(() => {
  if (originalOwner === undefined) {
    delete process.env.OWNER_EMAIL;
  } else {
    process.env.OWNER_EMAIL = originalOwner;
  }
});

describe("normalizeEmail", () => {
  it("trims and lowercases", () => {
    expect(normalizeEmail("  Jake@Example.COM ")).toBe("jake@example.com");
  });
});

describe("isOwnerEmail", () => {
  it("matches the configured owner, ignoring case and surrounding space", () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    expect(isOwnerEmail("owner@example.com")).toBe(true);
    expect(isOwnerEmail("  OWNER@example.com")).toBe(true);
  });

  it("rejects a different signed-in address", () => {
    process.env.OWNER_EMAIL = "owner@example.com";
    expect(isOwnerEmail("stranger@example.com")).toBe(false);
  });

  it("rejects missing emails or an unset OWNER_EMAIL", () => {
    delete process.env.OWNER_EMAIL;
    expect(isOwnerEmail("owner@example.com")).toBe(false);

    process.env.OWNER_EMAIL = "owner@example.com";
    expect(isOwnerEmail(null)).toBe(false);
    expect(isOwnerEmail(undefined)).toBe(false);
    expect(isOwnerEmail("")).toBe(false);
  });
});
