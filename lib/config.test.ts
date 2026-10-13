import { describe, expect, it } from "vitest";
import { PACKS } from "./config";

describe("config", () => {
  it("has unique pack ids with positive letter counts", () => {
    const ids = PACKS.map((p) => p.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const pack of PACKS) expect(pack.letters).toBeGreaterThan(0);
  });
});
