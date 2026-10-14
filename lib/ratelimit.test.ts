import { describe, expect, it } from "vitest";
import { clientIp, freeLettersUsed, hasFreeLetterLeft, hashIp, memoryFreeUsageStore } from "@/lib/ratelimit";

describe("hashIp", () => {
  it("is stable for the same input and changes with the day and salt", () => {
    const a = hashIp("203.0.113.5", "salt", "2026-10-14");
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(hashIp("203.0.113.5", "salt", "2026-10-14")).toBe(a);
    expect(hashIp("203.0.113.5", "salt", "2026-10-15")).not.toBe(a);
    expect(hashIp("203.0.113.5", "other", "2026-10-14")).not.toBe(a);
    expect(a).not.toContain("203.0.113.5");
  });
});

describe("clientIp", () => {
  it("takes the first x-forwarded-for entry, then x-real-ip", () => {
    expect(clientIp(new Headers({ "x-forwarded-for": "203.0.113.5, 10.0.0.1" }))).toBe("203.0.113.5");
    expect(clientIp(new Headers({ "x-real-ip": "198.51.100.7" }))).toBe("198.51.100.7");
    expect(clientIp(new Headers())).toBe("unknown");
  });
});

describe("free letter cookie", () => {
  it("allows one free letter per device and ignores garbage", () => {
    expect(hasFreeLetterLeft(undefined)).toBe(true);
    expect(hasFreeLetterLeft("0")).toBe(true);
    expect(hasFreeLetterLeft("1")).toBe(false);
    expect(freeLettersUsed("abc")).toBe(0);
    expect(freeLettersUsed("-4")).toBe(0);
  });
});

describe("memoryFreeUsageStore", () => {
  it("enforces the daily limit per hash and day, and releases", async () => {
    const store = memoryFreeUsageStore();
    for (let i = 0; i < 3; i++) expect(await store.consume("h", "2026-10-14", 3)).toBe(true);
    expect(await store.consume("h", "2026-10-14", 3)).toBe(false);
    expect(await store.consume("h", "2026-10-15", 3)).toBe(true);
    expect(await store.consume("other", "2026-10-14", 3)).toBe(true);
    await store.release("h", "2026-10-14");
    expect(await store.consume("h", "2026-10-14", 3)).toBe(true);
  });

  it("never goes below zero", async () => {
    const store = memoryFreeUsageStore();
    await store.release("h", "d");
    expect(await store.consume("h", "d", 1)).toBe(true);
    expect(await store.consume("h", "d", 1)).toBe(false);
  });
});
