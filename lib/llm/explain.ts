import Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_LLM_MODEL } from "@/lib/config";
import { computeUrgency, estimateDeadline, todayInGermany, type Urgency } from "@/lib/deadline";
import { SYSTEM_PROMPT, USER_INSTRUCTION } from "@/lib/llm/prompt";
import { letterCardOutputFormat, validateLetterCard, type LetterCard } from "@/lib/llm/schema";
import { referralFor } from "@/lib/referrals";

// Model call, validation and one retry. Nothing in here may log letter content or model output.

export type ImageMediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";

export type LetterInput =
  | { kind: "images"; images: { mediaType: ImageMediaType; data: string }[] }
  | { kind: "pdf"; data: string };

export type ExplainFailure = "invalid_output" | "refusal" | "upstream";

export type ExplainResult =
  | { ok: true; card: LetterCard }
  | { ok: false; reason: ExplainFailure; status?: number };

type CreateParams = Anthropic.Beta.Messages.MessageCreateParamsNonStreaming;
type CreateMessage = (params: CreateParams) => Promise<Anthropic.Beta.Messages.BetaMessage>;

export interface ExplainDeps {
  createMessage?: CreateMessage;
  model?: string;
}

const MAX_ATTEMPTS = 2;

function defaultCreateMessage(): CreateMessage {
  const client = new Anthropic();
  return (params) => client.beta.messages.create(params);
}

function letterContent(input: LetterInput): Anthropic.Beta.Messages.BetaContentBlockParam[] {
  const blocks: Anthropic.Beta.Messages.BetaContentBlockParam[] =
    input.kind === "pdf"
      ? [{ type: "document", source: { type: "base64", media_type: "application/pdf", data: input.data } }]
      : input.images.map((image) => ({
          type: "image" as const,
          source: { type: "base64" as const, media_type: image.mediaType, data: image.data },
        }));
  return [...blocks, { type: "text", text: USER_INSTRUCTION }];
}

function retryInstruction(issues: string[]): string {
  return [
    "Your answer did not pass validation:",
    ...issues.map((issue) => `- ${issue}`),
    "Return the complete corrected card.",
  ].join("\n");
}

function readOutput(message: Anthropic.Beta.Messages.BetaMessage): unknown {
  const text = message.content.find((block) => block.type === "text");
  if (!text || text.type !== "text") return undefined;
  try {
    return JSON.parse(text.text);
  } catch {
    return undefined;
  }
}

export async function explainLetter(input: LetterInput, deps: ExplainDeps = {}): Promise<ExplainResult> {
  const createMessage = deps.createMessage ?? defaultCreateMessage();
  const model = deps.model ?? process.env.LLM_MODEL ?? DEFAULT_LLM_MODEL;
  const messages: Anthropic.Beta.Messages.BetaMessageParam[] = [
    { role: "user", content: letterContent(input) },
  ];

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    let message: Anthropic.Beta.Messages.BetaMessage;
    try {
      message = await createMessage({
        model,
        max_tokens: 16000,
        system: SYSTEM_PROMPT,
        messages,
        output_config: { effort: "medium", format: letterCardOutputFormat },
        // On a safety decline, the API reruns the request on a fallback model it picks.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      });
    } catch (error) {
      if (error instanceof Anthropic.APIError) {
        return { ok: false, reason: "upstream", status: error.status };
      }
      throw error;
    }

    if (message.stop_reason === "refusal") return { ok: false, reason: "refusal" };

    const raw = readOutput(message);
    const result =
      raw === undefined
        ? { ok: false as const, issues: ["(root): the answer was not complete, valid JSON"] }
        : validateLetterCard(raw);
    if (result.ok) return { ok: true, card: result.card };

    messages.push(
      { role: "assistant", content: message.content },
      { role: "user", content: retryInstruction(result.issues) },
    );
  }

  return { ok: false, reason: "invalid_output" };
}

export type EnrichedCard = Omit<LetterCard, "deadline"> & {
  deadline: LetterCard["deadline"] & { estimated_date: string | null };
  urgency: Urgency;
  referral: string;
};

/** Fields computed in code after validation: estimated deadline, urgency and referral. */
export function enrichCard(card: LetterCard, today: string = todayInGermany()): EnrichedCard {
  const estimatedDate = estimateDeadline(card.deadline, card.letter_date);
  return {
    ...card,
    deadline: { ...card.deadline, estimated_date: estimatedDate },
    urgency: computeUrgency({
      deadline: card.deadline,
      estimatedDate,
      enforcementLanguage: card.enforcement_language,
      today,
    }),
    referral: referralFor(card.sender.type),
  };
}
