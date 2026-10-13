import type { SenderType } from "@/lib/llm/schema";

// Who to ask when the reader needs judgment about their own case.

const DEFAULT_REFERRAL = "the Verbraucherzentrale (consumer advice centre)";

const REFERRALS: Partial<Record<SenderType, string>> = {
  tax_office: "a Steuerberater (tax advisor) or a Lohnsteuerhilfeverein (income tax help association)",
  landlord: "a Mieterverein (tenant association)",
  immigration_office: "free Migrationsberatung (migration advice), or a lawyer for migration law",
  jobcenter: "a Sozialberatung (social advice service), or a lawyer for social law",
  employment_agency: "a Sozialberatung (social advice service), or a lawyer for social law",
  debt_collector: "the Verbraucherzentrale (consumer advice centre) or a Schuldnerberatung (debt advice service)",
  court: "a lawyer (Rechtsanwalt)",
  police: "a lawyer (Rechtsanwalt)",
  broadcasting_fee: "the Beitragsservice directly",
  health_insurance: "the insurer's customer service",
  university: "the university's international office",
};

export function referralFor(type: SenderType): string {
  return REFERRALS[type] ?? DEFAULT_REFERRAL;
}
