import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CodeForm } from "@/components/CodeForm";
import { isPublicDemo } from "@/lib/demo";
import { PACKS, type Pack } from "@/lib/config";
import { formatEuro } from "@/lib/format";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Letter packs · Klartext" };

type Prices = Partial<Record<Pack["id"], number>>;

/** Prices live in Stripe. Missing or failing prices just hide the amount; checkout still shows it. */
async function loadPrices(): Promise<Prices> {
  if (!isStripeConfigured()) return {};
  const entries = await Promise.all(
    PACKS.map(async (pack) => {
      const priceId = process.env[pack.priceEnv];
      if (!priceId) return null;
      try {
        const price = await stripe().prices.retrieve(priceId);
        return price.currency === "eur" && price.unit_amount !== null ? ([pack.id, price.unit_amount / 100] as const) : null;
      } catch {
        return null;
      }
    }),
  );
  return Object.fromEntries(entries.filter((entry) => entry !== null));
}

function PackList({ prices }: { prices: Prices }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      {PACKS.map((pack) => {
        const price = prices[pack.id];
        return (
          <form
            key={pack.id}
            action="/api/checkout"
            method="POST"
            className="flex flex-col gap-3 rounded-[4px] bg-surface p-6 shadow-[0_1px_0_var(--line),0_18px_40px_-26px_rgba(20,24,43,0.5)]"
          >
            <input type="hidden" name="pack" value={pack.id} />
            <p className="font-display text-5xl font-extrabold leading-none">
              {pack.letters} <span className="text-2xl font-bold">letters</span>
            </p>
            <p className="min-h-6 text-muted">
              {price !== undefined
                ? `${formatEuro(price)} · ${formatEuro(price / pack.letters)} per letter`
                : " "}
            </p>
            <button
              type="submit"
              className="mt-auto rounded-[6px] bg-accent px-5 py-3 font-display text-xl font-bold text-on-accent hover:bg-accent/90"
            >
              Buy {pack.letters} letters
            </button>
          </form>
        );
      })}
    </div>
  );
}

async function PackListWithPrices() {
  await connection();
  return <PackList prices={await loadPrices()} />;
}

export default function BuyPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-10 px-4 py-10 sm:py-16">
      <section className="space-y-3">
        <Link href="/" className="text-sm text-muted hover:underline">
          ← Back
        </Link>
        <h1 className="font-display text-5xl font-extrabold leading-none tracking-tight">Letter packs</h1>
        <p className="text-lg text-muted">Pay once. No account, no subscription. Failed or unreadable letters are free.</p>
      </section>

      {isPublicDemo() ? (
        <p className="rounded-[4px] border-l-4 border-warn bg-warn-bg px-4 py-3 font-medium text-warn">
          Buying is turned off in this demo.
        </p>
      ) : (
        <Suspense fallback={<PackList prices={{}} />}>
          <PackListWithPrices />
        </Suspense>
      )}

      <p className="text-sm text-muted">Payment by Stripe. We never see your card, name or email.</p>

      <section className="space-y-3 border-t border-dashed border-line pt-8">
        <h2 className="font-display text-2xl font-bold">Already have a code?</h2>
        <CodeForm />
      </section>
    </main>
  );
}
