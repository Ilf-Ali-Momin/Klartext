import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleCheckout } from "@/lib/api/payments";
import { logError } from "@/lib/log";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  if (!isStripeConfigured()) return NextResponse.json({ error: "not_configured" }, { status: 503 });
  try {
    return await handleCheckout(request, {
      createSession: (params) => stripe().checkout.sessions.create(params),
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? request.nextUrl.origin,
      priceFor: (envName) => process.env[envName],
      requestId,
    });
  } catch (error) {
    logError(requestId, error instanceof Error ? error.name : "unknown", 502);
    return NextResponse.json({ error: "checkout_failed" }, { status: 502, headers: { "x-request-id": requestId } });
  }
}
