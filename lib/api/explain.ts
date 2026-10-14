import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { FREE_LETTERS_PER_IP_PER_DAY, MAX_IMAGES, MAX_UPLOAD_MB } from "@/lib/config";
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
  | "model_failed"
  | "not_configured"
  | "server_error";

const MESSAGES: Record<ExplainErrorCode, string> = {
  invalid_input: "We couldn't read that upload. Try again with up to 4 photos or one PDF.",
  too_large: `That file is too big. Files can be up to ${MAX_UPLOAD_MB} MB.`,
  payment_required: "You've used your free letter. Buy a pack to explain more letters.",
  daily_limit: "Too many free letters were explained from this network today. Try again tomorrow or buy a pack.",
  model_failed: "We couldn't explain this letter right now. Please try again in a moment.",
  not_configured: "The service is not set up yet. Please try again later.",
  server_error: "Something went wrong on our side. Please try again.",
};

const STATUS: Record<ExplainErrorCode, number> = {
  invalid_input: 400,
  too_large: 413,
  payment_required: 402,
  daily_limit: 429,
  model_failed: 502,
  not_configured: 503,
  server_error: 500,
};

function errorResponse(code: ExplainErrorCode, requestId: string): NextResponse {
  const status = STATUS[code];
  if (status >= 500) logError(requestId, code, status);
  const buyUrl = code === "payment_required" || code === "daily_limit" ? "/buy" : undefined;
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

export interface ExplainHandlerDeps {
  explain?: (input: LetterInput) => Promise<ExplainResult>;
  store: FreeUsageStore;
  salt: string;
  today?: string;
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

  // Entitlement. Paid credit codes are added in the payments phase.
  const freeCookie = request.cookies.get(FREE_COOKIE)?.value;
  if (!hasFreeLetterLeft(freeCookie)) return errorResponse("payment_required", requestId);

  const ipHash = hashIp(clientIp(request.headers), deps.salt, today);
  if (!(await deps.store.consume(ipHash, today, FREE_LETTERS_PER_IP_PER_DAY))) {
    return errorResponse("daily_limit", requestId);
  }

  let result: ExplainResult;
  try {
    result = await explain(toLetterInput(parsed.data));
  } catch {
    await deps.store.release(ipHash, today);
    return errorResponse("model_failed", requestId);
  }

  if (!result.ok) {
    await deps.store.release(ipHash, today);
    return errorResponse("model_failed", requestId);
  }

  const card = enrichCard(result.card, today);
  const response = NextResponse.json({ card }, { headers: { "x-request-id": requestId } });

  if (!card.readable) {
    // An unreadable photo does not use up the free letter.
    await deps.store.release(ipHash, today);
    return response;
  }

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
