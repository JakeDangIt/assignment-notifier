import { describe, expect, it } from "vitest";
import { formatLocalDateTime, parseLocalDateTime, wallTimeToUtc } from "./time";

const NY = "America/New_York";

describe("parseLocalDateTime", () => {
  it("round-trips a winter (EST, UTC-5) wall time", () => {
    const utc = parseLocalDateTime("2026-01-15T08:30", NY);
    expect(utc.toISOString()).toBe("2026-01-15T13:30:00.000Z");
    expect(formatLocalDateTime(utc, NY)).toBe("2026-01-15T08:30");
  });

  it("round-trips a summer (EDT, UTC-4) wall time", () => {
    const utc = parseLocalDateTime("2026-07-15T08:30", NY);
    expect(utc.toISOString()).toBe("2026-07-15T12:30:00.000Z");
    expect(formatLocalDateTime(utc, NY)).toBe("2026-07-15T08:30");
  });

  it("constructs the instant after the spring-forward gap", () => {
    // 2026-03-08 02:00 does not exist in America/New_York; TZDate should still
    // produce a well-defined instant rather than throwing.
    const utc = wallTimeToUtc({
      year: 2026,
      month: 3,
      day: 8,
      hours: 2,
      minutes: 30,
      timezone: NY,
    });
    expect(utc.getTime()).toBeGreaterThan(parseLocalDateTime("2026-03-08T01:00", NY).getTime());
  });
});
