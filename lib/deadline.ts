import type { Deadline, RelativePeriod } from "@/lib/llm/schema";

// Deterministic deadline maths. All dates are ISO yyyy-mm-dd calendar dates, computed in UTC
// so that daylight saving time never shifts a day.

export type Urgency = "act_now" | "act_soon" | "info_only";

export const ACT_NOW_WITHIN_DAYS = 14;

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function toUtc(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

function toIso(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function daysInMonth(year: number, monthIndex: number): number {
  return new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();
}

/** Add a period to a date. Month arithmetic clamps to month end (Jan 31 + 1 month = Feb 28/29). */
export function addPeriod(iso: string, count: number, unit: RelativePeriod["unit"]): string {
  const date = toUtc(iso);
  if (unit === "day" || unit === "week") {
    const days = unit === "week" ? count * 7 : count;
    return toIso(new Date(date.getTime() + days * MS_PER_DAY));
  }
  const totalMonths = date.getUTCFullYear() * 12 + date.getUTCMonth() + count;
  const year = Math.floor(totalMonths / 12);
  const monthIndex = totalMonths % 12;
  const day = Math.min(date.getUTCDate(), daysInMonth(year, monthIndex));
  return toIso(new Date(Date.UTC(year, monthIndex, day)));
}

/**
 * Estimated date for a relative deadline, counted from the letter date. The letter date is the
 * earliest possible start, so the estimate is never later than the real deadline.
 */
export function estimateDeadline(deadline: Deadline, letterDate: string | null): string | null {
  if (deadline.kind !== "relative" || !deadline.relative_period || !letterDate) return null;
  const { count, unit } = deadline.relative_period;
  return addPeriod(letterDate, count, unit);
}

/** Whole days from `today` to `date`. Negative when the date has passed. */
export function daysUntil(date: string, today: string): number {
  return Math.round((toUtc(date).getTime() - toUtc(today).getTime()) / MS_PER_DAY);
}

export function computeUrgency(input: {
  deadline: Deadline;
  estimatedDate: string | null;
  enforcementLanguage: boolean;
  today: string;
}): Urgency {
  const { deadline, estimatedDate, enforcementLanguage, today } = input;
  if (enforcementLanguage) return "act_now";
  const effective = deadline.kind === "fixed" ? deadline.date : estimatedDate;
  if (effective && daysUntil(effective, today) <= ACT_NOW_WITHIN_DAYS) return "act_now";
  if (deadline.kind !== "none") return "act_soon";
  return "info_only";
}

/** Today's date in Germany, where the letters' deadlines apply. */
export function todayInGermany(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Berlin",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}
