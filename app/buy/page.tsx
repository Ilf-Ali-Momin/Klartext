import Link from "next/link";
import type { Metadata } from "next";
import { connection } from "next/server";
import { Suspense } from "react";
import { CodeForm } from "@/components/CodeForm";
import { PACKS, type Pack } from "@/lib/config";
import { formatEuro } from "@/lib/format";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Letter packs · Briefklar" };

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
            className="flex flex-col gap-3 rounded-2xl border border-line bg-surface p-5"
          >
            <input type="hidden" name="pack" value={pack.id} />
            <p className="text-2xl font-semibold">{pack.letters} letters</p>
            <p className="min-h-6 text-muted">
              {price !== undefined
                ? `${formatEuro(price)} · ${formatEuro(price / pack.letters)} per letter`
                : " "}
            </p>
            <button
              type="submit"
              className="mt-auto rounded-xl bg-accent px-5 py-3 font-semibold text-on-accent hover:bg-accent/90"
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
        <h1 className="text-3xl font-semibold tracking-tight">Letter packs</h1>
        <p className="text-lg text-muted">
          Pay once, no account and no subscription. You get a code that works for the number of letters in your pack.
          Unreadable photos and failed explanations don&apos;t use up a letter.
        </p>
      </section>

      <Suspense fallback={<PackList prices={{}} />}>
        <PackListWithPrices />
      </Suspense>

      <p className="text-sm text-muted">
        Payment is handled by Stripe. We never see your card details, and we don&apos;t store your name or email.
      </p>

      <section className="space-y-3 border-t border-line pt-8">
        <h2 className="text-xl font-semibold">Already have a code?</h2>
        <CodeForm />
      </section>
    </main>
  );
}
