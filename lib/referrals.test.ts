import { describe, expect, it } from "vitest";
import { SENDER_TYPES } from "@/lib/llm/schema";
import { referralFor } from "@/lib/referrals";

describe("referralFor", () => {
  it("maps sender types to the right professional", () => {
    expect(referralFor("tax_office")).toContain("Steuerberater");
    expect(referralFor("tax_office")).toContain("Lohnsteuerhilfeverein");
    expect(referralFor("landlord")).toContain("Mieterverein");
    expect(referralFor("immigration_office")).toContain("Migrationsberatung");
    expect(referralFor("jobcenter")).toContain("Sozialberatung");
    expect(referralFor("employment_agency")).toBe(referralFor("jobcenter"));
    expect(referralFor("debt_collector")).toContain("Schuldnerberatung");
    expect(referralFor("court")).toContain("Rechtsanwalt");
    expect(referralFor("police")).toContain("Rechtsanwalt");
    expect(referralFor("broadcasting_fee")).toContain("Beitragsservice");
    expect(referralFor("health_insurance")).toContain("insurer");
    expect(referralFor("university")).toContain("international office");
  });

  it("falls back to the Verbraucherzentrale for everything else", () => {
    for (const type of ["utility", "bank", "employer", "other"] as const) {
      expect(referralFor(type)).toContain("Verbraucherzentrale");
    }
  });

  it("returns a referral for every sender type", () => {
    for (const type of SENDER_TYPES) expect(referralFor(type).length).toBeGreaterThan(0);
  });
});
