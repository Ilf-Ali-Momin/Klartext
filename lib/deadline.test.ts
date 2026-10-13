import { describe, expect, it } from "vitest";
import { addPeriod, computeUrgency, daysUntil, estimateDeadline, todayInGermany } from "@/lib/deadline";
import type { Deadline } from "@/lib/llm/schema";

const relative = (count: number, unit: "day" | "week" | "month"): Deadline => ({
  kind: "relative",
  date: null,
  relative_period: { count, unit, from: "receipt" },
  original_text: null,
  translation: null,
});

const fixed = (date: string): Deadline => ({
  kind: "fixed",
  date,
  relative_period: null,
  original_text: null,
  translation: null,
});

const none: Deadline = { kind: "none", date: null, relative_period: null, original_text: null, translation: null };

describe("addPeriod", () => {
  it("adds days and weeks across month and year ends", () => {
    expect(addPeriod("2026-10-05", 14, "day")).toBe("2026-10-19");
    expect(addPeriod("2026-12-25", 2, "week")).toBe("2027-01-08");
  });

  it("does not shift a day across daylight saving time changes", () => {
    expect(addPeriod("2026-03-20", 14, "day")).toBe("2026-04-03");
    expect(addPeriod("2026-10-20", 14, "day")).toBe("2026-11-03");
  });

  it("clamps month arithmetic to month end", () => {
    expect(addPeriod("2026-01-31", 1, "month")).toBe("2026-02-28");
    expect(addPeriod("2028-01-31", 1, "month")).toBe("2028-02-29");
    expect(addPeriod("2026-03-31", 1, "month")).toBe("2026-04-30");
    expect(addPeriod("2026-08-31", 6, "month")).toBe("2027-02-28");
  });

  it("keeps the day when it exists and crosses year ends", () => {
    expect(addPeriod("2026-09-15", 1, "month")).toBe("2026-10-15");
    expect(addPeriod("2026-11-30", 3, "month")).toBe("2027-02-28");
    expect(addPeriod("2026-12-15", 1, "month")).toBe("2027-01-15");
  });
});

describe("estimateDeadline", () => {
  it("counts a relative deadline from the letter date", () => {
    expect(estimateDeadline(relative(1, "month"), "2026-09-15")).toBe("2026-10-15");
  });

  it("returns null without a letter date or for non-relative deadlines", () => {
    expect(estimateDeadline(relative(1, "month"), null)).toBeNull();
    expect(estimateDeadline(fixed("2026-10-20"), "2026-09-15")).toBeNull();
    expect(estimateDeadline(none, "2026-09-15")).toBeNull();
  });
});

describe("computeUrgency", () => {
  const today = "2026-10-13";
  const base = { estimatedDate: null, enforcementLanguage: false, today };

  it("is act_now when enforcement language is present, even without a deadline", () => {
    expect(computeUrgency({ ...base, deadline: none, enforcementLanguage: true })).toBe("act_now");
  });

  it("is act_now for a fixed deadline within 14 days, including today and past dates", () => {
    expect(computeUrgency({ ...base, deadline: fixed("2026-10-27") })).toBe("act_now");
    expect(computeUrgency({ ...base, deadline: fixed(today) })).toBe("act_now");
    expect(computeUrgency({ ...base, deadline: fixed("2026-10-01") })).toBe("act_now");
  });

  it("is act_soon for a fixed deadline more than 14 days away", () => {
    expect(computeUrgency({ ...base, deadline: fixed("2026-10-28") })).toBe("act_soon");
  });

  it("uses the estimated date for relative deadlines", () => {
    expect(computeUrgency({ ...base, deadline: relative(1, "month"), estimatedDate: "2026-10-20" })).toBe("act_now");
    expect(computeUrgency({ ...base, deadline: relative(1, "month"), estimatedDate: "2026-11-30" })).toBe("act_soon");
  });

  it("is act_soon for a relative deadline that cannot be estimated", () => {
    expect(computeUrgency({ ...base, deadline: relative(1, "month") })).toBe("act_soon");
  });

  it("is info_only without a deadline or enforcement language", () => {
    expect(computeUrgency({ ...base, deadline: none })).toBe("info_only");
  });
});

describe("dates", () => {
  it("counts whole days", () => {
    expect(daysUntil("2026-10-27", "2026-10-13")).toBe(14);
    expect(daysUntil("2026-10-12", "2026-10-13")).toBe(-1);
  });

  it("uses the German calendar day", () => {
    expect(todayInGermany(new Date("2026-10-13T22:30:00Z"))).toBe("2026-10-14");
    expect(todayInGermany(new Date("2026-10-13T21:30:00Z"))).toBe("2026-10-13");
  });
});
