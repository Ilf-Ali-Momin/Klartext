import { CodeForm } from "@/components/CodeForm";
import { Explainer } from "@/components/Explainer";
import { HeroLetter } from "@/components/HeroLetter";
import { EyeOffIcon, LockIcon, NoAccountIcon } from "@/components/Icons";
import { LetterCard } from "@/components/LetterCard";
import { SAMPLE_CARD, SAMPLE_TODAY } from "@/lib/sample-card";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 pb-16 pt-8 sm:px-6 sm:pt-14">
      <div className="grid items-start gap-10 lg:grid-cols-[1fr_1fr] lg:gap-14" data-hero-grid>
        <div className="space-y-7">
          <header className="space-y-4" data-print-hide-when-result>
            <p className="font-display text-xl font-bold text-accent">Klartext</p>
            <h1 data-hide-with-result className="font-display text-[3.1rem] font-extrabold leading-[0.95] tracking-tight text-balance sm:text-7xl">
              Amtsdeutsch in. Plain English out.
            </h1>
            <p data-hide-with-result className="max-w-md text-lg text-muted">
              Snap your letter. See what it says, what to do and by when.
            </p>
          </header>

          <Explainer />

          <div className="space-y-5" data-print-hide-when-result data-hide-with-result>
            <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm font-medium text-muted">
              <li className="flex items-center gap-1.5">
                <LockIcon /> Never stored
              </li>
              <li className="flex items-center gap-1.5">
                <NoAccountIcon /> No account
              </li>
              <li className="flex items-center gap-1.5">
                <EyeOffIcon /> No tracking
              </li>
            </ul>
            <details className="group text-sm print:hidden">
              <summary className="cursor-pointer font-semibold text-accent">Have a code?</summary>
              <div className="pt-3">
                <CodeForm />
              </div>
            </details>
          </div>
        </div>

        <div className="lg:pt-24" data-print-hide-when-result data-hide-with-result>
          <HeroLetter />
        </div>
      </div>

      <details className="group mt-16 sm:mt-20" data-print-hide-when-result data-hide-with-result>
        <summary className="cursor-pointer font-display text-2xl font-bold">See a full example</summary>
        <p className="mt-2 max-w-xl text-muted">
          The card for the letter above. Your photo goes to our AI provider, Anthropic, to be read, and is never saved.
          This is an explanation, not legal advice.
        </p>
        <div className="mt-5 max-w-2xl">
          <LetterCard card={SAMPLE_CARD} today={SAMPLE_TODAY} />
        </div>
      </details>
    </main>
  );
}
