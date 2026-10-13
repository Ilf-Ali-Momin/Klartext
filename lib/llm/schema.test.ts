import { describe, expect, it } from "vitest";
import { MAX_KEY_TERMS, validateLetterCard } from "@/lib/llm/schema";
import { sampleCard } from "@/lib/test-helpers";

describe("validateLetterCard", () => {
  it("accepts a valid card", () => {
    expect(validateLetterCard(sampleCard()).ok).toBe(true);
  });

  it("rejects an unknown sender type", () => {
    const card = { ...sampleCard(), sender: { name: "X", type: "alien" } };
    const result = validateLetterCard(card);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).toContain("sender.type");
  });

  it("rejects dates that are not ISO calendar dates", () => {
    for (const letter_date of ["15.09.2026", "2026-02-30", "2026-9-15"]) {
      expect(validateLetterCard({ ...sampleCard(), letter_date }).ok).toBe(false);
    }
  });

  it("rejects a non-EUR currency and a missing field", () => {
    const card = sampleCard();
    expect(validateLetterCard({ ...card, amount: { ...card.amount, currency: "USD" } }).ok).toBe(false);
    const missing: Record<string, unknown> = { ...card };
    delete missing.confidence;
    expect(validateLetterCard(missing).ok).toBe(false);
  });

  it("rejects a non-integer or zero relative period", () => {
    for (const count of [1.5, 0]) {
      const deadline = { ...sampleCard().deadline, relative_period: { count, unit: "day", from: "receipt" } };
      expect(validateLetterCard({ ...sampleCard(), deadline }).ok).toBe(false);
    }
  });

  it("enforces deadline kind consistency", () => {
    const fixedWithoutDate = sampleCard({
      deadline: { kind: "fixed", date: null, relative_period: null, original_text: null, translation: null },
    });
    const relativeWithDate = sampleCard({
      deadline: { ...sampleCard().deadline, date: "2026-10-15" },
    });
    const noneWithPeriod = sampleCard({ deadline: { ...sampleCard().deadline, kind: "none" } });
    for (const card of [fixedWithoutDate, relativeWithDate, noneWithPeriod]) {
      const result = validateLetterCard(card);
      expect(result.ok).toBe(false);
      if (!result.ok) expect(result.issues.join()).toMatch(/^deadline\./);
    }
  });

  it("requires a reason when the letter is unreadable", () => {
    expect(validateLetterCard(sampleCard({ readable: false })).ok).toBe(false);
    expect(
      validateLetterCard(sampleCard({ readable: false, unreadable_reason: "The photo is blurry." })).ok,
    ).toBe(true);
  });

  it("keeps at most five key terms", () => {
    const term = { german: "Bescheid", english: "notice", meaning: "An official decision." };
    const result = validateLetterCard(sampleCard({ key_terms: Array(7).fill(term) }));
    expect(result.ok && result.card.key_terms).toHaveLength(MAX_KEY_TERMS);
  });

  it("never puts field values into issue messages", () => {
    const result = validateLetterCard({ ...sampleCard(), letter_date: "SECRET-VALUE" });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.issues.join()).not.toContain("SECRET-VALUE");
  });
});
