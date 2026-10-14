import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { FREE_LETTERS_PER_IP_PER_DAY, MAX_IMAGES, MAX_UPLOAD_MB, PAID_REQUESTS_PER_CODE_PER_HOUR } from "@/lib/config";
import { CODE_COOKIE, hourBucket, normalizeCode, type CreditStore } from "@/lib/credits";
import { todayInGermany } from "@/lib/deadline";
import { enrichCard, explainLetter, type ExplainResult, type LetterInput } from "@/lib/llm/explain";
import { logError } from "@/lib/log";
import {
  FREE_COOKIE,
  FREE_COOKIE_MAX_AGE,
  clientIp,
  freeLettersUsed,
  hasFreeLetterLeft,
  hashIp,
  type FreeUsageStore,
} from "@/lib/ratelimit";

// POST /api/explain: images or a PDF in, an enriched LetterCard out. Nothing about the letter is kept.

const MAX_BYTES = MAX_UPLOAD_MB * 1024 * 1024;
const BASE64 = /^[A-Za-z0-9+/]+={0,2}$/;

function decodedBytes(base64: string): number {
  const padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  return Math.floor((base64.length * 3) / 4) - padding;
}

const base64File = z
  .string()
  .min(1)
  .regex(BASE64)
  .refine((data) => decodedBytes(data) <= MAX_BYTES, { message: "too_large" });

export const ExplainRequestSchema = z.union([
  z.object({
    images: z
      .array(z.object({ mediaType: z.enum(["image/jpeg", "image/png", "image/webp"]), data: base64File }))
      .min(1)
      .max(MAX_IMAGES),
  }),
  z.object({ pdf: base64File }),
]);

export type ExplainRequest = z.infer<typeof ExplainRequestSchema>;

export type ExplainErrorCode =
  | "invalid_input"
  | "too_large"
  | "payment_required"
  | "daily_limit"
  | "no_credits_left"
  | "paid_rate_limit"
  | "model_failed"
  | "not_configured"
  | "server_error";

const MESSAGES: Record<ExplainErrorCode, string> = {
  invalid_input: "We couldn't read that upload. Try again with up to 4 photos or one PDF.",
  too_large: `That file is too big. Files can be up to ${MAX_UPLOAD_MB} MB.`,
  payment_required: "You've used your free letter. Buy a pack to explain more letters.",
  daily_limit: "Too many free letters were explained from this network today. Try again tomorrow or buy a pack.",
  no_credits_left: "Your code has no letters left. Buy a pack to explain more letters.",
  paid_rate_limit: "You've explained a lot of letters in the last hour. Please wait a little and try again.",
  model_failed: "We couldn't explain this letter right now. Please try again in a moment.",
  not_configured: "The service is not set up yet. Please try again later.",
  server_error: "Something went wrong on our side. Please try again.",
};

const STATUS: Record<ExplainErrorCode, number> = {
  invalid_input: 400,
  too_large: 413,
  payment_required: 402,
  daily_limit: 429,
  no_credits_left: 402,
  paid_rate_limit: 429,
  model_failed: 502,
  not_configured: 503,
  server_error: 500,
};

function errorResponse(code: ExplainErrorCode, requestId: string): NextResponse {
  const status = STATUS[code];
  if (status >= 500) logError(requestId, code, status);
  const buyUrl = code === "payment_required" || code === "daily_limit" || code === "no_credits_left" ? "/buy" : undefined;
  return NextResponse.json(
    { error: code, message: MESSAGES[code], ...(buyUrl ? { buy_url: buyUrl } : {}) },
    { status, headers: { "x-request-id": requestId } },
  );
}

function toLetterInput(body: ExplainRequest): LetterInput {
  return "pdf" in body
    ? { kind: "pdf", data: body.pdf }
    : { kind: "images", images: body.images.map((image) => ({ mediaType: image.mediaType, data: image.data })) };
}

type Entitlement = { kind: "free"; ipHash: string } | { kind: "paid"; code: string; creditsLeft: number };

export interface ExplainHandlerDeps {
  explain?: (input: LetterInput) => Promise<ExplainResult>;
  store: FreeUsageStore;
  credits: CreditStore;
  salt: string;
  today?: string;
  hour?: string;
  requestId?: string;
  secureCookies?: boolean;
}

export async function handleExplain(request: NextRequest, deps: ExplainHandlerDeps): Promise<NextResponse> {
  const requestId = deps.requestId ?? crypto.randomUUID();
  const explain = deps.explain ?? ((input: LetterInput) => explainLetter(input));
  const today = deps.today ?? todayInGermany();

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return errorResponse("invalid_input", requestId);
  }
  const parsed = ExplainRequestSchema.safeParse(json);
  if (!parsed.success) {
    const tooLarge = parsed.error.issues.some((issue) => issue.message === "too_large");
    return errorResponse(tooLarge ? "too_large" : "invalid_input", requestId);
  }

  // Entitlement: the device's free letter first, then a credit code.
  const freeCookie = request.cookies.get(FREE_COOKIE)?.value;
  const code = normalizeCode(request.cookies.get(CODE_COOKIE)?.value ?? "");
  let entitlement: Entitlement | null = null;

  if (hasFreeLetterLeft(freeCookie)) {
    const ipHash = hashIp(clientIp(request.headers), deps.salt, today);
    if (await deps.store.consume(ipHash, today, FREE_LETTERS_PER_IP_PER_DAY)) {
      entitlement = { kind: "free", ipHash };
    } else if (!code) {
      return errorResponse("daily_limit", requestId);
    }
  }

  if (!entitlement) {
    if (!code) return errorResponse("payment_required", requestId);
    const hour = deps.hour ?? hourBucket();
    if (!(await deps.credits.consumeHourly(code, hour, PAID_REQUESTS_PER_CODE_PER_HOUR))) {
      const known = (await deps.credits.creditsLeft(code)) !== null;
      return errorResponse(known ? "paid_rate_limit" : "payment_required", requestId);
    }
    const creditsLeft = await deps.credits.reserve(code);
    if (creditsLeft === null) return errorResponse("no_credits_left", requestId);
    entitlement = { kind: "paid", code, creditsLeft };
  }

  const active = entitlement;
  /** Give the letter back. Returns the credits left for a paid code. */
  async function giveBack(): Promise<number | undefined> {
    if (active.kind === "free") {
      await deps.store.release(active.ipHash, today);
      return undefined;
    }
    return (await deps.credits.refund(active.code)) ?? undefined;
  }

  let result: ExplainResult;
  try {
    result = await explain(toLetterInput(parsed.data));
  } catch {
    await giveBack();
    return errorResponse("model_failed", requestId);
  }

  if (!result.ok) {
    await giveBack();
    return errorResponse("model_failed", requestId);
  }

  const card = enrichCard(result.card, today);

  if (!card.readable) {
    // An unreadable photo does not use up a letter.
    const creditsLeft = await giveBack();
    return NextResponse.json(
      { card, ...(creditsLeft !== undefined ? { credits_left: creditsLeft } : {}) },
      { headers: { "x-request-id": requestId } },
    );
  }

  if (active.kind === "paid") {
    return NextResponse.json({ card, credits_left: active.creditsLeft }, { headers: { "x-request-id": requestId } });
  }

  const response = NextResponse.json({ card }, { headers: { "x-request-id": requestId } });
  response.cookies.set(FREE_COOKIE, String(freeLettersUsed(freeCookie) + 1), {
    httpOnly: true,
    sameSite: "lax",
    secure: deps.secureCookies ?? process.env.NODE_ENV === "production",
    path: "/",
    maxAge: FREE_COOKIE_MAX_AGE,
  });
  return response;
}

export { errorResponse };
