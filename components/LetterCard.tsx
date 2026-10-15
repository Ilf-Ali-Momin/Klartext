"use client";

import { useState, type ReactNode } from "react";
import { CopyField } from "@/components/CopyField";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { Disclaimer } from "@/components/Disclaimer";
import { ACT_NOW_WITHIN_DAYS } from "@/lib/deadline";
import { formatDate, formatEuro } from "@/lib/format";
import type { EnrichedCard } from "@/lib/llm/explain";

const STAMP = {
  act_now: { text: "Act now", className: "text-danger" },
  act_soon: { text: "To do", className: "text-accent" },
  info_only: { text: "For info", className: "text-ok" },
} as const;

function urgencyReason(card: EnrichedCard): string {
  if (card.urgency === "act_now") {
    return card.enforcement_language
      ? "The letter mentions a reminder, enforcement or court action."
      : `The deadline is within ${ACT_NOW_WITHIN_DAYS} days or has passed.`;
  }
  if (card.urgency === "act_soon") return "The letter asks you to do something by a deadline.";
  return "Nothing to do by a deadline.";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="break-inside-avoid space-y-2 border-t border-dashed border-line pt-5">
      <h2 className="font-display text-xl font-bold">{title}</h2>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => (
        <li key={i}>
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={done[i]}
              onChange={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              className="mt-1 size-5 shrink-0 accent-accent"
            />
            <span className={done[i] ? "text-muted line-through" : ""}>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function LetterCard({ card, today }: { card: EnrichedCard; today: string }) {
  const stamp = STAMP[card.urgency];
  const payment = card.payment;
  const hasPayment = payment && (payment.recipient || payment.iban || payment.reference);

  return (
    <article className="relative space-y-5 rounded-[4px] bg-surface p-6 shadow-[0_1px_0_var(--line),0_22px_44px_-26px_rgba(20,24,43,0.55)] sm:p-8 print:p-0 print:shadow-none">
      <span
        className={`stamp absolute -top-3 right-3 bg-surface sm:right-6 ${stamp.className}`}
        role="status"
        aria-label={`${stamp.text}. ${urgencyReason(card)}`}
      >
        {stamp.text}
      </span>
      <header className="space-y-1">
        <p className="pr-28 text-sm text-muted">{card.sender.name}</p>
        <h2 className="font-display text-3xl font-bold leading-[1.05] text-balance">{card.letter_type}</h2>
        {card.letter_date && <p className="text-sm text-muted">Letter from {formatDate(card.letter_date)}</p>}
      </header>

      {card.confidence !== "high" && (
        <p className="rounded-[4px] border-l-4 border-warn bg-warn-bg px-3 py-2 text-sm text-warn">
          Parts were hard to read. Check the details against the original.
        </p>
      )}

      <DeadlineBadge card={card} today={today} reason={urgencyReason(card)} />

      {card.what_they_want.length > 0 && (
        <Section title="To do">
          <Checklist items={card.what_they_want} />
        </Section>
      )}

      <Section title="What it says">
        <p className="leading-relaxed">{card.summary}</p>
        {card.if_ignored && (
          <p className="leading-relaxed">
            <span className="font-semibold">If nothing happens: </span>
            {card.if_ignored}
          </p>
        )}
      </Section>

      {(card.amount || hasPayment) && (
        <Section title="Pay">
          {card.amount && (
            <div className="pb-1">
              <p className="font-display text-4xl font-extrabold leading-none">
                <span className="marker">{formatEuro(card.amount.value)}</span>
              </p>
              <p className="mt-2 text-muted">{card.amount.what_for}</p>
            </div>
          )}
          {hasPayment && (
            <div className="divide-y divide-line">
              {payment.recipient && <CopyField label="Recipient" value={payment.recipient} mono={false} />}
              {payment.iban && <CopyField label="IBAN" value={payment.iban} />}
              {payment.reference && <CopyField label="Payment reference" value={payment.reference} />}
            </div>
          )}
        </Section>
      )}

      {card.reference_numbers.length > 0 && (
        <Section title="Reference numbers">
          <div className="divide-y divide-line">
            {card.reference_numbers.map((ref, i) => (
              <CopyField key={i} label={ref.label} value={ref.value} />
            ))}
          </div>
        </Section>
      )}

      {card.key_terms.length > 0 && (
        <Section title="Words to know">
          <dl className="space-y-3">
            {card.key_terms.map((term, i) => (
              <div key={i}>
                <dt>
                  <span lang="de" className="font-semibold">
                    {term.german}
                  </span>{" "}
                  <span className="text-muted">({term.english})</span>
                </dt>
                <dd className="text-sm leading-relaxed">{term.meaning}</dd>
              </div>
            ))}
          </dl>
        </Section>
      )}

      {card.caution_flags.length > 0 && (
        <div className="break-inside-avoid rounded-[4px] border-l-4 border-warn bg-warn-bg p-4 text-warn">
          <p className="font-display text-xl font-bold">Watch out</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {card.caution_flags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Need advice?">
        <p>Ask {card.referral}.</p>
      </Section>

      <div className="border-t border-dashed border-line pt-4">
        <Disclaimer />
      </div>
    </article>
  );
}
