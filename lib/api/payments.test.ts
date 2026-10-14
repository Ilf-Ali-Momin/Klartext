import Stripe from "stripe";
import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { claimFromSession, handleCheckout, handleCode, handleWebhook } from "@/lib/api/payments";
import { CODE_COOKIE, memoryCreditStore, type CreditStore } from "@/lib/credits";

const stripe = new Stripe("sk_test_dummy");
const SECRET = "whsec_test_secret";

function form(pack: string | null) {
  const body = new URLSearchParams();
  if (pack !== null) body.set("pack", pack);
  return new NextRequest("http://localhost/api/checkout", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });
}

function stripeEvent(type: string, session: Record<string, unknown>) {
  return JSON.stringify({
    id: "evt_test",
    object: "event",
    type,
    data: { object: { id: "cs_test_abc", object: "checkout.session", ...session } },
  });
}

function webhookRequest(payload: string, signature?: string) {
  const headers = new Headers({ "content-type": "application/json" });
  if (signature) headers.set("stripe-signature", signature);
  return new NextRequest("http://localhost/api/stripe/webhook", { method: "POST", headers, body: payload });
}

const constructEvent = (payload: string, signature: string) =>
  stripe.webhooks.constructEvent(payload, signature, SECRET);

function silenceErrors() {
  return vi.spyOn(console, "error").mockImplementation(() => {});
}

describe("handleCheckout", () => {
  const createSession = vi.fn<(params: Stripe.Checkout.SessionCreateParams) => Promise<{ url: string }>>(
    async () => ({ url: "https://checkout.stripe.com/c/pay/cs_test_abc" }),
  );
  const deps = {
    createSession,
    appUrl: "https://briefklar.example",
    priceFor: (env: string) => (env === "STRIPE_PRICE_PACK5" ? "price_5" : env === "STRIPE_PRICE_PACK15" ? "price_15" : undefined),
    requestId: "req",
  };

  beforeEach(() => createSession.mockClear());

  it("creates a payment session for the pack and redirects to Stripe", async () => {
    const res = await handleCheckout(form("pack15"), deps);
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe("https://checkout.stripe.com/c/pay/cs_test_abc");
    expect(createSession).toHaveBeenCalledWith({
      mode: "payment",
      line_items: [{ price: "price_15", quantity: 1 }],
      metadata: { pack: "pack15" },
      success_url: "https://briefklar.example/success?session_id={CHECKOUT_SESSION_ID}",
      cancel_url: "https://briefklar.example/buy",
    });
  });

  it("rejects an unknown or missing pack", async () => {
    expect((await handleCheckout(form("pack999"), deps)).status).toBe(400);
    expect((await handleCheckout(form(null), deps)).status).toBe(400);
    expect(createSession).not.toHaveBeenCalled();
  });

  it("returns 503 when the price is not configured", async () => {
    const errors = silenceErrors();
    const res = await handleCheckout(form("pack5"), { ...deps, priceFor: () => undefined });
    expect(res.status).toBe(503);
    errors.mockRestore();
  });
});

describe("handleWebhook", () => {
  let store: CreditStore;
  beforeEach(() => {
    store = memoryCreditStore();
  });

  it("grants credits for a paid session, once, with a valid signature", async () => {
    const payload = stripeEvent("checkout.session.completed", { payment_status: "paid", metadata: { pack: "pack5" } });
    const signature = stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET });
    expect((await handleWebhook(webhookRequest(payload, signature), { constructEvent, store })).status).toBe(200);
    expect((await handleWebhook(webhookRequest(payload, signature), { constructEvent, store })).status).toBe(200);

    const claim = await claimFromSession("cs_test_abc", {
      retrieveSession: async () => ({ id: "cs_test_abc", payment_status: "paid", metadata: { pack: "pack5" }, url: null }),
      store,
    });
    expect(claim).toMatchObject({ status: "paid", creditsLeft: 5 });
  });

  it("rejects a bad or missing signature", async () => {
    const errors = silenceErrors();
    const payload = stripeEvent("checkout.session.completed", { payment_status: "paid", metadata: { pack: "pack5" } });
    const forged = stripe.webhooks.generateTestHeaderString({ payload, secret: "whsec_wrong" });
    expect((await handleWebhook(webhookRequest(payload, forged), { constructEvent, store })).status).toBe(400);
    expect((await handleWebhook(webhookRequest(payload), { constructEvent, store })).status).toBe(400);
    errors.mockRestore();
  });

  it("does not grant credits for an unpaid session until the async payment succeeds", async () => {
    const createSpy = vi.spyOn(store, "create");
    const pending = stripeEvent("checkout.session.completed", { payment_status: "unpaid", metadata: { pack: "pack5" } });
    await handleWebhook(
      webhookRequest(pending, stripe.webhooks.generateTestHeaderString({ payload: pending, secret: SECRET })),
      { constructEvent, store },
    );
    expect(createSpy).not.toHaveBeenCalled();

    const paid = stripeEvent("checkout.session.async_payment_succeeded", {
      payment_status: "paid",
      metadata: { pack: "pack5" },
    });
    await handleWebhook(
      webhookRequest(paid, stripe.webhooks.generateTestHeaderString({ payload: paid, secret: SECRET })),
      { constructEvent, store },
    );
    expect(createSpy).toHaveBeenCalledTimes(1);
  });

  it("acknowledges an unknown pack without granting credits", async () => {
    const errors = silenceErrors();
    const createSpy = vi.spyOn(store, "create");
    const payload = stripeEvent("checkout.session.completed", { payment_status: "paid", metadata: { pack: "nope" } });
    const res = await handleWebhook(
      webhookRequest(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })),
      { constructEvent, store },
    );
    expect(res.status).toBe(200);
    expect(createSpy).not.toHaveBeenCalled();
    errors.mockRestore();
  });

  it("returns 500 so Stripe retries when storing fails", async () => {
    const errors = silenceErrors();
    vi.spyOn(store, "create").mockRejectedValue(new Error("db down"));
    const payload = stripeEvent("checkout.session.completed", { payment_status: "paid", metadata: { pack: "pack5" } });
    const res = await handleWebhook(
      webhookRequest(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })),
      { constructEvent, store },
    );
    expect(res.status).toBe(500);
    errors.mockRestore();
  });

  it("ignores other event types", async () => {
    const createSpy = vi.spyOn(store, "create");
    const payload = stripeEvent("checkout.session.expired", { payment_status: "unpaid", metadata: { pack: "pack5" } });
    const res = await handleWebhook(
      webhookRequest(payload, stripe.webhooks.generateTestHeaderString({ payload, secret: SECRET })),
      { constructEvent, store },
    );
    expect(res.status).toBe(200);
    expect(createSpy).not.toHaveBeenCalled();
  });
});

describe("claimFromSession", () => {
  const session = (payment_status: Stripe.Checkout.Session.PaymentStatus, pack = "pack15") => async () => ({
    id: "cs_test_abc",
    payment_status,
    metadata: { pack },
    url: null,
  });

  it("returns the same code on every visit, matching the webhook's", async () => {
    const store = memoryCreditStore();
    const first = await claimFromSession("cs_test_abc", { retrieveSession: session("paid"), store });
    const again = await claimFromSession("cs_test_abc", { retrieveSession: session("paid"), store });
    expect(first.status).toBe("paid");
    expect(again).toEqual(first);
    if (first.status === "paid") expect(first.creditsLeft).toBe(15);
  });

  it("reports a pending payment and invalid sessions", async () => {
    const store = memoryCreditStore();
    expect(await claimFromSession("cs_test_abc", { retrieveSession: session("unpaid"), store })).toEqual({
      status: "pending",
    });
    expect(await claimFromSession(undefined, { retrieveSession: session("paid"), store })).toEqual({ status: "invalid" });
    expect(await claimFromSession("not-a-session", { retrieveSession: session("paid"), store })).toEqual({
      status: "invalid",
    });
    const missing = async () => {
      throw new Error("No such checkout.session");
    };
    expect(await claimFromSession("cs_test_missing", { retrieveSession: missing, store })).toEqual({ status: "invalid" });
  });
});

describe("handleCode", () => {
  function codeRequest(code: unknown) {
    return new NextRequest("http://localhost/api/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    });
  }

  it("saves a known code on the device and returns the credits left", async () => {
    const store = memoryCreditStore();
    await store.create({ code: "ABCDEFGHJK", sessionId: "cs_1", pack: "pack5", credits: 5 });
    const res = await handleCode(codeRequest("abcde-fghjk"), { store });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ credits_left: 5 });
    const cookie = res.cookies.get(CODE_COOKIE);
    expect(cookie?.value).toBe("ABCDEFGHJK");
    expect(cookie?.httpOnly).toBe(true);
  });

  it("rejects unknown and malformed codes without setting a cookie", async () => {
    const store = memoryCreditStore();
    for (const code of ["ZZZZZ-ZZZZZ", "short", 42]) {
      const res = await handleCode(codeRequest(code), { store });
      expect(res.status).toBe(404);
      expect(res.cookies.get(CODE_COOKIE)).toBeUndefined();
    }
  });
});
