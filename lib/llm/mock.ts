import { addPeriod, todayInGermany } from "@/lib/deadline";
import { isPublicDemo } from "@/lib/demo";
import type { ExplainResult } from "@/lib/llm/explain";
import type { LetterCard } from "@/lib/llm/schema";

// Demo mode: LLM_MOCK=1 (development) or DEMO_DEPLOYMENT=1 (public demo) returns a fixed, fictional card
// instead of calling the model. It never reads the uploaded letter.

export function isMockEnabled(): boolean {
  if (isPublicDemo()) return true;
  if (process.env.LLM_MOCK !== "1") return false;
  if (process.env.NODE_ENV === "production") throw new Error("LLM_MOCK must not be set in production");
  return true;
}

/** A fictional broadcasting fee reminder, dated around today so the urgency banner is realistic. */
export function mockCard(today: string = todayInGermany()): LetterCard {
  const letterDate = addPeriod(today, -7, "day");
  const deadline = addPeriod(today, 10, "day");
  return {
    readable: true,
    unreadable_reason: null,
    sender: { name: "Beitragsservice Musterstadt (demo)", type: "broadcasting_fee" },
    letter_type: "Payment reminder (Zahlungserinnerung)",
    letter_date: letterDate,
    summary:
      "DEMO RESULT: this card is fictional and was not made from your upload. In a real result you would read a plain English summary here. This example is a reminder that the broadcasting fee for three months is unpaid.",
    what_they_want: [
      "Pay €55.08 to Beitragsservice Musterstadt.",
      "Use your Beitragsnummer 987654321 as the payment reference.",
    ],
    deadline: {
      kind: "fixed",
      date: deadline,
      relative_period: null,
      original_text: "Bitte überweisen Sie den Betrag bis zum angegebenen Datum.",
      translation: "Please transfer the amount by the date given.",
    },
    amount: {
      value: 55.08,
      currency: "EUR",
      what_for: "Broadcasting fee for three months",
      original_text: "55,08 Euro",
    },
    payment: {
      recipient: "Beitragsservice Musterstadt",
      iban: "DE00 1234 5678 9012 3456 78",
      reference: "987654321",
    },
    reference_numbers: [{ label: "Beitragsnummer (contribution number)", value: "987 654 321" }],
    if_ignored: null,
    enforcement_language: false,
    key_terms: [
      {
        german: "Rundfunkbeitrag",
        english: "broadcasting fee",
        meaning: "A monthly fee every household in Germany pays for public radio and TV.",
      },
      { german: "Zahlungserinnerung", english: "payment reminder", meaning: "A friendly reminder that a payment is open." },
    ],
    caution_flags: [],
    confidence: "high",
  };
}

const DEMO_DELAY_MS = 1500;

// Takes no input on purpose: demo mode never reads the upload.
export async function mockExplain(): Promise<ExplainResult> {
  await new Promise((resolve) => setTimeout(resolve, DEMO_DELAY_MS));
  return { ok: true, card: mockCard() };
}
