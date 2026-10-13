import Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { enrichCard, explainLetter, type ExplainDeps } from "@/lib/llm/explain";
import { sampleCard } from "@/lib/test-helpers";

type Message = Anthropic.Beta.Messages.BetaMessage;
type CreateMessage = NonNullable<ExplainDeps["createMessage"]>;

function reply(text: string, stop_reason: Message["stop_reason"] = "end_turn"): Message {
  return {
    id: "msg_test",
    type: "message",
    role: "assistant",
    model: "test",
    content: [{ type: "text", text, citations: null }],
    stop_reason,
    stop_sequence: null,
  } as unknown as Message;
}

function fakeClient(...replies: (Message | Error)[]) {
  const createMessage = vi.fn<CreateMessage>();
  for (const r of replies) {
    if (r instanceof Error) createMessage.mockRejectedValueOnce(r);
    else createMessage.mockResolvedValueOnce(r);
  }
  return createMessage;
}

const pdf = { kind: "pdf" as const, data: "JVBERi0=" };

describe("explainLetter", () => {
  it("returns a validated card on the first try", async () => {
    const createMessage = fakeClient(reply(JSON.stringify(sampleCard())));
    const result = await explainLetter(pdf, { createMessage, model: "test-model" });
    expect(result).toEqual({ ok: true, card: sampleCard() });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("sends the document, system prompt and structured output format", async () => {
    const createMessage = fakeClient(reply(JSON.stringify(sampleCard())));
    await explainLetter(pdf, { createMessage, model: "test-model" });
    const params = createMessage.mock.calls[0][0];
    expect(params.model).toBe("test-model");
    expect(params.system).toContain("plain English");
    expect(params.output_config?.format?.type).toBe("json_schema");
    const content = params.messages[0].content as Anthropic.Beta.Messages.BetaContentBlockParam[];
    expect(content[0]).toMatchObject({ type: "document", source: { media_type: "application/pdf" } });
  });

  it("sends one image block per page, in order", async () => {
    const createMessage = fakeClient(reply(JSON.stringify(sampleCard())));
    await explainLetter(
      {
        kind: "images",
        images: [
          { mediaType: "image/jpeg", data: "page1" },
          { mediaType: "image/jpeg", data: "page2" },
        ],
      },
      { createMessage },
    );
    const content = createMessage.mock.calls[0][0].messages[0].content as Anthropic.Beta.Messages.BetaContentBlockParam[];
    expect(content.map((b) => b.type)).toEqual(["image", "image", "text"]);
    expect(content[1]).toMatchObject({ source: { data: "page2" } });
  });

  it("retries once with the validation errors appended", async () => {
    const bad = { ...sampleCard(), letter_date: "15.09.2026" };
    const createMessage = fakeClient(reply(JSON.stringify(bad)), reply(JSON.stringify(sampleCard())));
    const result = await explainLetter(pdf, { createMessage });
    expect(result.ok).toBe(true);
    expect(createMessage).toHaveBeenCalledTimes(2);
    const retry = createMessage.mock.calls[1][0].messages;
    expect(retry).toHaveLength(3);
    expect(retry[1].role).toBe("assistant");
    expect(retry[2]).toMatchObject({ role: "user" });
    expect(String(retry[2].content)).toContain("letter_date");
  });

  it("retries on output that is not JSON", async () => {
    const createMessage = fakeClient(reply("{not json", "max_tokens"), reply(JSON.stringify(sampleCard())));
    expect((await explainLetter(pdf, { createMessage })).ok).toBe(true);
  });

  it("fails after the second invalid answer", async () => {
    const bad = JSON.stringify({ ...sampleCard(), confidence: "certain" });
    const createMessage = fakeClient(reply(bad), reply(bad));
    expect(await explainLetter(pdf, { createMessage })).toEqual({ ok: false, reason: "invalid_output" });
    expect(createMessage).toHaveBeenCalledTimes(2);
  });

  it("does not retry a refusal", async () => {
    const createMessage = fakeClient(reply("", "refusal"));
    expect(await explainLetter(pdf, { createMessage })).toEqual({ ok: false, reason: "refusal" });
    expect(createMessage).toHaveBeenCalledTimes(1);
  });

  it("reports API errors as upstream failures", async () => {
    const error = new Anthropic.InternalServerError(500, undefined, "boom", new Headers());
    const createMessage = fakeClient(error);
    expect(await explainLetter(pdf, { createMessage })).toEqual({ ok: false, reason: "upstream", status: 500 });
  });
});

describe("enrichCard", () => {
  it("adds the estimated deadline, urgency and referral", () => {
    const card = enrichCard(sampleCard(), "2026-10-13");
    expect(card.deadline.estimated_date).toBe("2026-10-15");
    expect(card.urgency).toBe("act_now");
    expect(card.referral).toContain("Steuerberater");
  });

  it("leaves estimated_date null for a fixed deadline", () => {
    const card = enrichCard(
      sampleCard({
        deadline: { kind: "fixed", date: "2026-12-01", relative_period: null, original_text: null, translation: null },
      }),
      "2026-10-13",
    );
    expect(card.deadline.estimated_date).toBeNull();
    expect(card.urgency).toBe("act_soon");
  });
});
