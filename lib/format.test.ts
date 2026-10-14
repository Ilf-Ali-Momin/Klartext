import { describe, expect, it } from "vitest";
import { formatDate, formatEuro, relativeDays } from "@/lib/format";

describe("format", () => {
  it("formats dates without shifting the day", () => {
    expect(formatDate("2026-09-30")).toBe("Wednesday, 30 September 2026");
  });

  it("formats euros", () => {
    expect(formatEuro(97.35)).toBe("€97.35");
    expect(formatEuro(1842)).toBe("€1,842.00");
  });

  it("describes relative days", () => {
    expect(relativeDays("2026-10-14", "2026-10-14")).toBe("today");
    expect(relativeDays("2026-10-15", "2026-10-14")).toBe("tomorrow");
    expect(relativeDays("2026-10-24", "2026-10-14")).toBe("in 10 days");
    expect(relativeDays("2026-10-11", "2026-10-14")).toBe("3 days ago");
  });
});
