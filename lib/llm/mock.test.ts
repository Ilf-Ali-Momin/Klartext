import { afterEach, describe, expect, it, vi } from "vitest";
import { validateLetterCard } from "@/lib/llm/schema";
import { isMockEnabled, mockCard } from "@/lib/llm/mock";

describe("demo mode", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("returns a card that passes validation, dated around today", () => {
    const card = mockCard("2026-10-15");
    expect(validateLetterCard(card).ok).toBe(true);
    expect(card.letter_date).toBe("2026-10-08");
    expect(card.deadline.date).toBe("2026-10-25");
    expect(card.summary).toContain("DEMO");
  });

  it("is off unless LLM_MOCK is 1", () => {
    vi.stubEnv("LLM_MOCK", "");
    expect(isMockEnabled()).toBe(false);
    vi.stubEnv("LLM_MOCK", "1");
    vi.stubEnv("NODE_ENV", "development");
    expect(isMockEnabled()).toBe(true);
  });

  it("refuses to run in production", () => {
    vi.stubEnv("LLM_MOCK", "1");
    vi.stubEnv("NODE_ENV", "production");
    expect(() => isMockEnabled()).toThrow("production");
  });

  it("is always on in a public demo deployment, also in production", () => {
    vi.stubEnv("LLM_MOCK", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("DEMO_DEPLOYMENT", "1");
    expect(isMockEnabled()).toBe(true);
  });
});
