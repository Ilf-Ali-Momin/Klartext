import Link from "next/link";
import type { Metadata } from "next";
import { Suspense } from "react";
import { CopyField } from "@/components/CopyField";
import { SaveCode } from "@/components/SaveCode";
import { claimFromSession, type ClaimResult } from "@/lib/api/payments";
import { creditStore, formatCode } from "@/lib/credits";
import { logError } from "@/lib/log";
import { isStripeConfigured, stripe } from "@/lib/stripe";

export const metadata: Metadata = { title: "Your code · Briefklar", robots: { index: false } };

async function claim(sessionId: string | undefined): Promise<ClaimResult | "error"> {
  if (!isStripeConfigured()) return { status: "invalid" };
  try {
    return await claimFromSession(sessionId, {
      retrieveSession: (id) => stripe().checkout.sessions.retrieve(id),
      store: creditStore(),
    });
  } catch (error) {
    logError(crypto.randomUUID(), error instanceof Error ? error.name : "unknown", 500);
    return "error";
  }
}

async function SuccessContent({ searchParams }: { searchParams: PageProps<"/success">["searchParams"] }) {
  const { session_id } = await searchParams;
  const result = await claim(typeof session_id === "string" ? session_id : undefined);

  if (result === "error") {
    return <p>We couldn&apos;t load your code right now. Please refresh this page in a moment.</p>;
  }
  if (result.status === "pending") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Your payment is being processed</h1>
        <p>Some payment methods take a little longer. Refresh this page in a few minutes to see your code.</p>
      </div>
    );
  }
  if (result.status === "invalid") {
    return (
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">We couldn&apos;t find this payment</h1>
        <p>
          Check the link, or <Link href="/buy" className="font-semibold underline">go to the letter packs</Link>.
        </p>
      </div>
    );
  }

  const left = result.creditsLeft;
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold">Thank you. Here is your code.</h1>
        {left !== null && (
          <p className="text-muted">
            It has {left} {left === 1 ? "letter" : "letters"} left.
          </p>
        )}
      </div>
      <div className="rounded-2xl border border-line bg-surface px-5 py-3">
        <CopyField label="Your code" value={formatCode(result.code)} />
      </div>
      <SaveCode code={result.code} />
      <div className="rounded-xl bg-warn-bg p-4 text-warn">
        <p className="font-semibold">Save this code somewhere safe.</p>
        <p className="text-sm">
          It is the only way to use your letters on another device or browser. We don&apos;t have your name or email,
          so we can&apos;t send it to you. You can also bookmark this page.
        </p>
      </div>
      <Link
        href="/"
        className="block rounded-xl bg-accent px-5 py-3 text-center font-semibold text-on-accent hover:bg-accent/90"
      >
        Explain a letter
      </Link>
    </div>
  );
}

export default function SuccessPage({ searchParams }: PageProps<"/success">) {
  return (
    <main className="mx-auto w-full max-w-xl flex-1 px-4 py-10 sm:py-16">
      <Suspense fallback={<p className="text-muted">Checking your payment…</p>}>
        <SuccessContent searchParams={searchParams} />
      </Suspense>
    </main>
  );
}
