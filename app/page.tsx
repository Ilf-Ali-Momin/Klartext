import { Explainer } from "@/components/Explainer";
import { LetterCard } from "@/components/LetterCard";
import { SAMPLE_CARD, SAMPLE_LETTER_EXCERPT, SAMPLE_TODAY } from "@/lib/sample-card";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-12 px-4 py-10 sm:py-16">
      <section className="space-y-4">
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

      <Explainer />

      <section className="space-y-4" aria-labelledby="example-heading">
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
