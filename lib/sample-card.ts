import type { EnrichedCard } from "@/lib/llm/explain";

// Example result for the landing page, based on the synthetic fixture fixtures/inkasso-forderung.pdf.
// All names and numbers are fictional.

export const SAMPLE_TODAY = "2026-10-08";

export const SAMPLE_CARD: EnrichedCard = {
  readable: true,
  unreadable_reason: null,
  sender: { name: "Muster Inkasso GmbH", type: "debt_collector" },
  letter_type: "Debt collection letter (Inkassoschreiben)",
  letter_date: "2026-10-05",
  summary:
    "A debt collection company writes on behalf of Beispiel Mobilfunk AG, a mobile phone provider. It says you owe money from your phone contract. The total includes the original amount plus reminder and collection fees.",
  what_they_want: [
    "Pay €97.35 to Muster Inkasso GmbH.",
    "Write the reference number IK-2026-004711 on the transfer.",
  ],
  deadline: {
    kind: "relative",
    date: null,
    relative_period: { count: 14, unit: "day", from: "letter_date" },
    original_text: "innerhalb von 14 Tagen ab Datum dieses Schreibens",
    translation: "within 14 days from the date of this letter",
    estimated_date: "2026-10-19",
  },
  amount: {
    value: 97.35,
    currency: "EUR",
    what_for: "Phone contract debt of €64.90 plus €32.45 in fees",
    original_text: "Gesamtbetrag: 97,35 Euro",
  },
  payment: { recipient: "Muster Inkasso GmbH", iban: "DE00 9876 5432 1098 7654 32", reference: "IK-2026-004711" },
  reference_numbers: [{ label: "Aktenzeichen (case number)", value: "IK-2026-004711" }],
  if_ignored: "The letter says the company may start a court payment procedure (gerichtliches Mahnverfahren).",
  enforcement_language: true,
  key_terms: [
    { german: "Hauptforderung", english: "main claim", meaning: "The original amount owed, before fees." },
    { german: "Inkassokosten", english: "collection fees", meaning: "Fees the debt collector adds for its work." },
    {
      german: "Mahnverfahren",
      english: "court payment procedure",
      meaning: "A simplified court process to collect a debt.",
    },
  ],
  caution_flags: [
    "This is a debt collection letter. Before paying, check that you know the original company and the debt.",
  ],
  confidence: "high",
  urgency: "act_now",
  referral:
    "the Verbraucherzentrale (consumer advice centre) or a Schuldnerberatung (debt advice service)",
};
