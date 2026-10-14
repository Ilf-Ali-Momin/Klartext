import Link from "next/link";
import { CodeForm } from "@/components/CodeForm";
import { Explainer } from "@/components/Explainer";
import { LetterCard } from "@/components/LetterCard";
import { SAMPLE_CARD, SAMPLE_LETTER_EXCERPT, SAMPLE_TODAY } from "@/lib/sample-card";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-12 px-4 py-10 sm:py-16">
      <section className="space-y-4" data-print-hide-when-result>
        <p className="inline-block rounded-full bg-ok-bg px-3 py-1 text-sm font-semibold text-ok">First letter free</p>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Understand your German letter in plain English.
        </h1>
        <p className="text-lg text-muted">
          Upload a photo or PDF of a letter from the Finanzamt, your landlord, the Jobcenter or anyone else. See who
          sent it, what it means, what you have to do and by when.
        </p>
        <p className="rounded-xl border border-line bg-surface px-4 py-3 text-sm">
          <span className="font-semibold">Private by design.</span> We don&apos;t store your letter. It&apos;s read,
          explained, and discarded.
        </p>
      </section>

      <div className="space-y-3">
        <Explainer />
        <details className="rounded-xl border border-line bg-surface px-4 py-3 print:hidden">
          <summary className="cursor-pointer font-medium">Have a code?</summary>
          <div className="pt-3">
            <CodeForm />
          </div>
        </details>
        <p className="text-center text-sm text-muted print:hidden">
          More letters? <Link href="/buy" className="font-medium underline">See letter packs</Link>
        </p>
      </div>

      <section className="space-y-3" aria-labelledby="privacy-heading" data-print-hide-when-result>
        <h2 id="privacy-heading" className="text-xl font-semibold">
          What happens to your letter
        </h2>
        <ul className="list-disc space-y-2 pl-5 leading-relaxed">
          <li>Your photos are made smaller in your browser before they are uploaded.</li>
          <li>
            Our server sends the letter to our AI provider, Anthropic, to read and explain it, and sends the
            explanation back to you.
          </li>
          <li>We don&apos;t save your letter or the explanation. Our logs never contain anything from your letter.</li>
          <li>There is no account, no tracking and no advertising.</li>
          <li>
            To give one free letter per device, we set a small cookie and count free letters per network with a
            scrambled (hashed) version of your IP address that we delete after a week.
          </li>
        </ul>
        <p className="text-sm text-muted">
          The explanation is not legal advice. For decisions about your own case, each card tells you who can help.
          Details are in our <Link href="/datenschutz" className="underline">privacy policy</Link>.
        </p>
      </section>

      <section className="space-y-4" aria-labelledby="example-heading" data-print-hide-when-result>
        <h2 id="example-heading" className="text-xl font-semibold">
          Example
        </h2>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">Before: the letter</p>
          <blockquote lang="de" className="space-y-1 rounded-xl border border-line bg-surface p-4 text-sm text-muted">
            {SAMPLE_LETTER_EXCERPT.map((line) => (
              <p key={line}>{line}</p>
            ))}
          </blockquote>
        </div>
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">After: your action card</p>
          <LetterCard card={SAMPLE_CARD} today={SAMPLE_TODAY} />
        </div>
        <p className="text-sm text-muted">Example with fictional names and numbers.</p>
      </section>
    </main>
  );
}
