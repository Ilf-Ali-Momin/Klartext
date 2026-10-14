import type Stripe from "stripe";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import {
  CODE_COOKIE,
  CODE_COOKIE_MAX_AGE,
  claimCredits,
  normalizeCode,
  packById,
  type CreditStore,
} from "@/lib/credits";
import { logError } from "@/lib/log";

// Payment handlers, kept out of the route files so they can be tested with fakes.

type CheckoutSessionParams = Stripe.Checkout.SessionCreateParams;
type CheckoutSession = Pick<Stripe.Checkout.Session, "id" | "payment_status" | "metadata" | "url">;

function json(body: unknown, status: number, requestId: string) {
  return NextResponse.json(body, { status, headers: { "x-request-id": requestId } });
}

export function setCodeCookie(response: NextResponse, code: string, secure = process.env.NODE_ENV === "production") {
  response.cookies.set(CODE_COOKIE, code, {
    httpOnly: true,
    sameSite: "lax",
    secure,
    path: "/",
    maxAge: CODE_COOKIE_MAX_AGE,
  });
}

// POST /api/checkout (HTML form): creates a Checkout session for a pack and redirects to Stripe.

export interface CheckoutDeps {
  createSession: (params: CheckoutSessionParams) => Promise<Pick<Stripe.Checkout.Session, "url">>;
  appUrl: string;
  priceFor: (envName: string) => string | undefined;
  requestId?: string;
}

export async function handleCheckout(request: NextRequest, deps: CheckoutDeps): Promise<NextResponse> {
  const requestId = deps.requestId ?? crypto.randomUUID();
  let packId: unknown;
  try {
    packId = (await request.formData()).get("pack");
  } catch {
    return json({ error: "invalid_input" }, 400, requestId);
  }
  const pack = typeof packId === "string" ? packById(packId) : undefined;
  if (!pack) return json({ error: "invalid_input" }, 400, requestId);

  const price = deps.priceFor(pack.priceEnv);
  if (!price) {
    logError(requestId, "price_not_configured", 503);
    return json({ error: "not_configured" }, 503, requestId);
  }

  const session = await deps.createSession({
    mode: "payment",
    line_items: [{ price, quantity: 1 }],
    metadata: { pack: pack.id },
    success_url: `${deps.appUrl}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${deps.appUrl}/buy`,
  });
  if (!session.url) {
    logError(requestId, "checkout_without_url", 502);
    return json({ error: "checkout_failed" }, 502, requestId);
  }
  return NextResponse.redirect(session.url, 303);
}

// POST /api/stripe/webhook: grants credits when a Checkout session is paid.

const PAID_EVENTS = new Set(["checkout.session.completed", "checkout.session.async_payment_succeeded"]);

export interface WebhookDeps {
  constructEvent: (payload: string, signature: string) => Stripe.Event;
  store: CreditStore;
  requestId?: string;
}

export async function handleWebhook(request: NextRequest, deps: WebhookDeps): Promise<NextResponse> {
  const requestId = deps.requestId ?? crypto.randomUUID();
  const signature = request.headers.get("stripe-signature");
  if (!signature) return json({ error: "missing_signature" }, 400, requestId);

  let event: Stripe.Event;
  try {
    event = deps.constructEvent(await request.text(), signature);
  } catch {
    logError(requestId, "invalid_signature", 400);
    return json({ error: "invalid_signature" }, 400, requestId);
  }

  if (PAID_EVENTS.has(event.type)) {
    const session = event.data.object as Stripe.Checkout.Session;
    const packId = session.metadata?.pack;
    if (session.payment_status === "paid") {
      if (!packId || !packById(packId)) {
        // Permanent problem: acknowledge so Stripe stops retrying. The owner finds it in the Stripe dashboard.
        logError(requestId, "unknown_pack", 200);
      } else {
        try {
          await claimCredits(deps.store, { sessionId: session.id, packId });
        } catch {
          // Stripe retries on a 5xx.
          logError(requestId, "claim_failed", 500);
          return json({ error: "claim_failed" }, 500, requestId);
        }
      }
    }
  }
  return json({ received: true }, 200, requestId);
}

// Success page: turns a paid Checkout session into a credit code.

export type ClaimResult =
  | { status: "paid"; code: string; creditsLeft: number | null }
  | { status: "pending" }
  | { status: "invalid" };

export async function claimFromSession(
  sessionId: string | undefined,
  deps: { retrieveSession: (id: string) => Promise<CheckoutSession>; store: CreditStore },
): Promise<ClaimResult> {
  if (!sessionId || !/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { status: "invalid" };
  let session: CheckoutSession;
  try {
    session = await deps.retrieveSession(sessionId);
  } catch {
    return { status: "invalid" };
  }
  const packId = session.metadata?.pack;
  if (!packId || !packById(packId)) return { status: "invalid" };
  if (session.payment_status !== "paid") return { status: "pending" };
  const code = await claimCredits(deps.store, { sessionId: session.id, packId });
  return { status: "paid", code, creditsLeft: await deps.store.creditsLeft(code) };
}

// POST /api/code: saves a credit code on this device after checking that it exists.

const CodeRequestSchema = z.object({ code: z.string().max(40) });

export async function handleCode(
  request: NextRequest,
  deps: { store: CreditStore; requestId?: string; secureCookies?: boolean },
): Promise<NextResponse> {
  const requestId = deps.requestId ?? crypto.randomUUID();
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return json({ error: "invalid_input", message: "Enter your code." }, 400, requestId);
  }
  const parsed = CodeRequestSchema.safeParse(body);
  const code = parsed.success ? normalizeCode(parsed.data.code) : null;
  const creditsLeft = code ? await deps.store.creditsLeft(code) : null;
  if (!code || creditsLeft === null) {
    return json(
      { error: "unknown_code", message: "We don't know this code. Check it and try again." },
      404,
      requestId,
    );
  }
  const response = json({ credits_left: creditsLeft }, 200, requestId);
  setCodeCookie(response, code, deps.secureCookies);
  return response;
}
