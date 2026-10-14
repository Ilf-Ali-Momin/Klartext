import { describe, expect, it } from "vitest";
import {
  CODE_ALPHABET,
  CODE_LENGTH,
  CodeTakenError,
  claimCredits,
  formatCode,
  generateCode,
  hourBucket,
  memoryCreditStore,
  normalizeCode,
} from "@/lib/credits";

describe("codes", () => {
  it("generates codes from the unambiguous alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateCode();
      expect(code).toHaveLength(CODE_LENGTH);
      for (const char of code) expect(CODE_ALPHABET).toContain(char);
    }
    expect(CODE_ALPHABET).not.toMatch(/[01OIL]/);
  });

  it("normalizes typed codes and rejects impossible ones", () => {
    expect(normalizeCode("abcde-fghjk")).toBe("ABCDEFGHJK");
    expect(normalizeCode(" ABCDE FGHJK ")).toBe("ABCDEFGHJK");
    expect(normalizeCode("ABCDE-FGHJ")).toBeNull();
    expect(normalizeCode("ABCDE-FGHJ0")).toBeNull();
    expect(normalizeCode("")).toBeNull();
  });

  it("formats codes in two groups", () => {
    expect(formatCode("ABCDEFGHJK")).toBe("ABCDE-FGHJK");
  });

  it("buckets by UTC hour", () => {
    expect(hourBucket(new Date("2026-10-14T09:59:59.999Z"))).toBe("2026-10-14T09:00:00.000Z");
  });
});

describe("memoryCreditStore", () => {
  it("reserves atomically down to zero and never refunds above the total", async () => {
    const store = memoryCreditStore();
    await store.create({ code: "AAAAAAAAAA", sessionId: "cs_1", pack: "pack5", credits: 2 });
    expect(await store.reserve("AAAAAAAAAA")).toBe(1);
    expect(await store.reserve("AAAAAAAAAA")).toBe(0);
    expect(await store.reserve("AAAAAAAAAA")).toBeNull();
    expect(await store.refund("AAAAAAAAAA")).toBe(1);
    expect(await store.refund("AAAAAAAAAA")).toBe(2);
    expect(await store.refund("AAAAAAAAAA")).toBe(2);
    expect(await store.reserve("UNKNOWNXXX")).toBeNull();
    expect(await store.refund("UNKNOWNXXX")).toBeNull();
  });
});

describe("claimCredits", () => {
  it("creates the pack's credits and is idempotent per session", async () => {
    const store = memoryCreditStore();
    const first = await claimCredits(store, { sessionId: "cs_1", packId: "pack15" });
    const second = await claimCredits(store, { sessionId: "cs_1", packId: "pack15" });
    expect(second).toBe(first);
    expect(await store.creditsLeft(first)).toBe(15);
  });

  it("retries with a new code when a code is taken", async () => {
    const store = memoryCreditStore();
    await store.create({ code: "TAKENTAKEN", sessionId: "cs_other", pack: "pack5", credits: 5 });
    const codes = ["TAKENTAKEN", "FRESHCODE2"];
    const code = await claimCredits(store, { sessionId: "cs_new", packId: "pack5" }, () => codes.shift()!);
    expect(code).toBe("FRESHCODE2");
  });

  it("rejects an unknown pack and gives up after repeated collisions", async () => {
    const store = memoryCreditStore();
    await expect(claimCredits(store, { sessionId: "cs_1", packId: "pack999" })).rejects.toThrow("Unknown pack");
    await store.create({ code: "TAKENTAKEN", sessionId: "cs_other", pack: "pack5", credits: 5 });
    await expect(claimCredits(store, { sessionId: "cs_2", packId: "pack5" }, () => "TAKENTAKEN")).rejects.toThrow(
      "unique",
    );
    expect(new CodeTakenError()).toBeInstanceOf(Error);
  });
});
