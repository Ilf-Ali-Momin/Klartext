import { describe, expect, it } from "vitest";
import { buildIcs } from "@/lib/ics";

const now = new Date("2026-10-14T09:30:00Z");

describe("buildIcs", () => {
  const ics = buildIcs(
    { date: "2026-12-31", title: "Deadline: pay, object; or ask", description: "Line one\nLine two" },
    now,
    "fixed-uid",
  );
  const lines = ics.split("\r\n");

  it("creates an all day event that ends the next day, across a year end", () => {
    expect(lines).toContain("DTSTART;VALUE=DATE:20261231");
    expect(lines).toContain("DTEND;VALUE=DATE:20270101");
    expect(lines).toContain("DTSTAMP:20261014T093000Z");
    expect(lines).toContain("UID:fixed-uid@klartext");
  });

  it("sets an alarm 3 days before", () => {
    expect(lines).toContain("TRIGGER:-P3D");
    expect(lines).toContain("BEGIN:VALARM");
  });

  it("escapes commas, semicolons and newlines", () => {
    expect(lines).toContain("SUMMARY:Deadline: pay\\, object\; or ask");
    expect(lines).toContain("DESCRIPTION:Line one\\nLine two");
  });

  it("uses CRLF line endings and balanced blocks", () => {
    expect(ics.endsWith("END:VCALENDAR\r\n")).toBe(true);
    expect(ics.replaceAll("\r\n", "")).not.toContain("\n");
    expect(lines.filter((l) => l.startsWith("BEGIN:"))).toHaveLength(3);
    expect(lines.filter((l) => l.startsWith("END:"))).toHaveLength(3);
  });

  it("folds long lines at 75 octets without breaking characters", () => {
    const long = buildIcs({ date: "2026-10-30", title: "Frist", description: "Gebühr für Überweisung ".repeat(10) }, now, "u");
    const physical = long.split("\r\n");
    const encoder = new TextEncoder();
    for (const line of physical) expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    expect(long.replaceAll("\r\n ", "")).toContain("Gebühr für Überweisung Gebühr");
  });
});
