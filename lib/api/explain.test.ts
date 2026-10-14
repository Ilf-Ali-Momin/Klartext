import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { handleExplain, type ExplainHandlerDeps } from "@/lib/api/explain";
import type { ExplainResult } from "@/lib/llm/explain";
import { FREE_COOKIE, memoryFreeUsageStore, type FreeUsageStore } from "@/lib/ratelimit";
import { sampleCard } from "@/lib/test-helpers";

const TODAY = "2026-10-14";
const JPEG = { mediaType: "image/jpeg", data: "/9j/4AAQSkZJRg==" };

function post(body: unknown, init: { cookie?: string; ip?: string; raw?: string } = {}) {
  const headers = new Headers({ "content-type": "application/json", "x-forwarded-for": init.ip ?? "203.0.113.5" });
  if (init.cookie) headers.set("cookie", init.cookie);
  return new NextRequest("http://localhost/api/explain", {
    method: "POST",
    headers,
    body: init.raw ?? JSON.stringify(body),
  });
}

describe("handleExplain", () => {
  let store: FreeUsageStore;
  let explain: ReturnType<typeof vi.fn<(input: unknown) => Promise<ExplainResult>>>;
  let deps: ExplainHandlerDeps;

  beforeEach(() => {
    store = memoryFreeUsageStore();
    explain = vi.fn(async () => ({ ok: true as const, card: sampleCard() }));
    deps = { store, explain, salt: "test", today: TODAY, requestId: "req-1" };
  });

  it("explains the first free letter and marks the device", async () => {
    const res = await handleExplain(post({ images: [JPEG] }), deps);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.card.urgency).toBeDefined();
    expect(body.card.referral).toContain("Steuerberater");
    expect(body.card.deadline.estimated_date).toBe("2026-10-15");
    const cookie = res.cookies.get(FREE_COOKIE);
    expect(cookie?.value).toBe("1");
    expect(cookie?.httpOnly).toBe(true);
    expect(explain).toHaveBeenCalledWith({ kind: "images", images: [JPEG] });
  });

  it("passes a PDF through as a document", async () => {
    await handleExplain(post({ pdf: "JVBERi0xLjQ=" }), deps);
    expect(explain).toHaveBeenCalledWith({ kind: "pdf", data: "JVBERi0xLjQ=" });
  });

  it("returns 402 with a buy link once the free letter is used", async () => {
    const res = await handleExplain(post({ images: [JPEG] }, { cookie: `${FREE_COOKIE}=1` }), deps);
    expect(res.status).toBe(402);
    expect(await res.json()).toMatchObject({ error: "payment_required", buy_url: "/buy" });
    expect(explain).not.toHaveBeenCalled();
  });

  it("returns 429 after the daily limit per IP, across devices", async () => {
    for (let i = 0; i < 3; i++) {
      expect((await handleExplain(post({ images: [JPEG] }), deps)).status).toBe(200);
    }
    const res = await handleExplain(post({ images: [JPEG] }), deps);
    expect(res.status).toBe(429);
    expect(await res.json()).toMatchObject({ error: "daily_limit", buy_url: "/buy" });
    expect((await handleExplain(post({ images: [JPEG] }, { ip: "198.51.100.7" }), deps)).status).toBe(200);
  });

  it("does not use up the free letter when the photo is unreadable", async () => {
    explain.mockResolvedValue({
      ok: true,
      card: sampleCard({ readable: false, unreadable_reason: "The photo is blurry." }),
    });
    for (let i = 0; i < 5; i++) {
      const res = await handleExplain(post({ images: [JPEG] }), deps);
      expect(res.status).toBe(200);
      expect((await res.json()).card.readable).toBe(false);
      expect(res.cookies.get(FREE_COOKIE)).toBeUndefined();
    }
  });

  it("returns 502 and gives the free letter back when the model fails", async () => {
    explain.mockResolvedValue({ ok: false, reason: "invalid_output" });
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    for (let i = 0; i < 5; i++) {
      const res = await handleExplain(post({ images: [JPEG] }), deps);
      expect(res.status).toBe(502);
      expect(res.cookies.get(FREE_COOKIE)).toBeUndefined();
    }
    expect(errors).toHaveBeenCalledWith(JSON.stringify({ level: "error", requestId: "req-1", type: "model_failed", status: 502 }));
    errors.mockRestore();
  });

  it("returns 502 when the model call throws", async () => {
    explain.mockRejectedValue(new Error("network"));
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    expect((await handleExplain(post({ images: [JPEG] }), deps)).status).toBe(502);
    errors.mockRestore();
  });

  it.each([
    ["broken JSON", undefined, "{"],
    ["no pages", { images: [] }, undefined],
    ["five pages", { images: Array(5).fill(JPEG) }, undefined],
    ["unsupported type", { images: [{ mediaType: "image/heic", data: "AAAA" }] }, undefined],
    ["not base64", { pdf: "not base64!" }, undefined],
    ["both images and pdf missing", { file: "AAAA" }, undefined],
  ])("rejects %s with 400", async (_name, body, raw) => {
    const res = await handleExplain(post(body, { raw }), deps);
    expect(res.status).toBe(400);
    expect(explain).not.toHaveBeenCalled();
  });

  it("rejects files over the size limit with 413", async () => {
    const big = "A".repeat(Math.ceil((4 * 1024 * 1024 * 4) / 3) + 8);
    const res = await handleExplain(post({ pdf: big }), deps);
    expect(res.status).toBe(413);
  });

  it("never logs letter content", async () => {
    const errors = vi.spyOn(console, "error").mockImplementation(() => {});
    const logs = vi.spyOn(console, "log").mockImplementation(() => {});
    explain.mockResolvedValueOnce({ ok: false, reason: "upstream", status: 500 });
    await handleExplain(post({ pdf: "JVBERi0xLjQ=" }), deps);
    await handleExplain(post({ pdf: "JVBERi0xLjQ=" }), deps);
    const output = [...errors.mock.calls, ...logs.mock.calls].flat().join(" ");
    expect(output).not.toContain("JVBERi0xLjQ=");
    expect(output).not.toContain("Finanzamt");
    errors.mockRestore();
    logs.mockRestore();
  });
});
