import type { LetterCard } from "@/lib/llm/schema";

/** A valid, fictional card. Override fields per test. */
export function sampleCard(overrides: Partial<LetterCard> = {}): LetterCard {
  return {
    readable: true,
    unreadable_reason: null,
    sender: { name: "Finanzamt Musterstadt", type: "tax_office" },
    letter_type: "Tax assessment (Steuerbescheid)",
    letter_date: "2026-09-15",
    summary: "The tax office has calculated your income tax for 2025. You get money back.",
    what_they_want: [],
    deadline: {
      kind: "relative",
      date: null,
      relative_period: { count: 1, unit: "month", from: "receipt" },
      original_text: "innerhalb eines Monats nach Bekanntgabe",
      translation: "within one month after notification",
    },
    amount: { value: 238, currency: "EUR", what_for: "Tax refund", original_text: "238,00 €" },
    payment: null,
    reference_numbers: [{ label: "Steuernummer", value: "123/456/78901" }],
    if_ignored: null,
    enforcement_language: false,
    key_terms: [],
    caution_flags: [],
    confidence: "high",
    ...overrides,
  };
}
