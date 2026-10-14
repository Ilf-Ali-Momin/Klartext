import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { handleWebhook } from "@/lib/api/payments";
import { creditStore } from "@/lib/credits";
import { logError } from "@/lib/log";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const requestId = crypto.randomUUID();
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!isStripeConfigured() || !secret) {
    logError(requestId, "webhook_not_configured", 503);
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }
  try {
    return await handleWebhook(request, {
      constructEvent: (payload, signature) => stripe().webhooks.constructEvent(payload, signature, secret),
      store: creditStore(),
      requestId,
    });
  } catch (error) {
    logError(requestId, error instanceof Error ? error.name : "unknown", 500);
    return NextResponse.json({ error: "server_error" }, { status: 500, headers: { "x-request-id": requestId } });
  }
}
