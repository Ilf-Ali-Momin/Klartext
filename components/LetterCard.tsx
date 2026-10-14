"use client";

import { useState, type ReactNode } from "react";
import { CopyField } from "@/components/CopyField";
import { DeadlineBadge } from "@/components/DeadlineBadge";
import { Disclaimer } from "@/components/Disclaimer";
import { ACT_NOW_WITHIN_DAYS } from "@/lib/deadline";
import { formatDate, formatEuro } from "@/lib/format";
import type { EnrichedCard } from "@/lib/llm/explain";

const URGENCY = {
  act_now: { title: "Act now", className: "bg-danger-bg text-danger border-danger/30" },
  act_soon: { title: "Act before the deadline", className: "bg-warn-bg text-warn border-warn/30" },
  info_only: { title: "For your information", className: "bg-ok-bg text-ok border-ok/30" },
} as const;

function urgencyReason(card: EnrichedCard): string {
  if (card.urgency === "act_now") {
    return card.enforcement_language
      ? "The letter mentions a reminder, enforcement or court action."
      : `The deadline is within ${ACT_NOW_WITHIN_DAYS} days or has passed.`;
  }
  if (card.urgency === "act_soon") return "The letter asks you to do something by a deadline.";
  return "This letter does not set a deadline.";
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="space-y-2 border-t border-line pt-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted">{title}</h2>
      {children}
    </section>
  );
}

function Checklist({ items }: { items: string[] }) {
  const [done, setDone] = useState<boolean[]>(() => items.map(() => false));
  return (
    <ul className="space-y-2">
      {items.map((item, i) => (
        <li key={i}>
          <label className="flex cursor-pointer gap-3">
            <input
              type="checkbox"
              checked={done[i]}
              onChange={() => setDone((d) => d.map((v, j) => (j === i ? !v : v)))}
              className="mt-1 size-4 shrink-0 accent-accent"
            />
            <span className={done[i] ? "text-muted line-through" : ""}>{item}</span>
          </label>
        </li>
      ))}
    </ul>
  );
}

export function LetterCard({ card, today }: { card: EnrichedCard; today: string }) {
  const urgency = URGENCY[card.urgency];
  const payment = card.payment;
  const hasPayment = payment && (payment.recipient || payment.iban || payment.reference);

  return (
    <article className="space-y-5 rounded-2xl border border-line bg-surface p-5 shadow-sm sm:p-7">
      <div className={`rounded-xl border px-4 py-3 ${urgency.className}`} role="status">
        <p className="text-lg font-semibold">{urgency.title}</p>
        <p className="text-sm">{urgencyReason(card)}</p>
      </div>

      <header className="space-y-1">
        <p className="text-sm text-muted">
          {card.sender.name}
          {card.letter_date && ` · ${formatDate(card.letter_date)}`}
        </p>
        <h1 className="text-xl font-semibold">{card.letter_type}</h1>
        {card.confidence !== "high" && (
          <p className="text-sm text-warn">
            Parts of this letter were hard to read. Check the details against the original.
          </p>
        )}
      </header>

      <DeadlineBadge card={card} today={today} />

      {card.what_they_want.length > 0 && (
        <Section title="What they want from you">
          <Checklist items={card.what_they_want} />
        </Section>
      )}

      <Section title="What the letter says">
        <p className="leading-relaxed">{card.summary}</p>
        {card.if_ignored && (
          <p className="leading-relaxed">
            <span className="font-medium">If nothing happens: </span>
            {card.if_ignored}
          </p>
        )}
      </Section>

      {(card.amount || hasPayment) && (
        <Section title="Amount and payment">
          {card.amount && (
            <div className="pb-1">
              <p className="text-2xl font-semibold">{formatEuro(card.amount.value)}</p>
              <p className="text-muted">{card.amount.what_for}</p>
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
        <Section title="Key German terms">
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
        <div className="rounded-xl border border-warn/30 bg-warn-bg p-4 text-warn">
          <p className="font-semibold">Be careful</p>
          <ul className="mt-1 list-disc space-y-1 pl-5 text-sm">
            {card.caution_flags.map((flag, i) => (
              <li key={i}>{flag}</li>
            ))}
          </ul>
        </div>
      )}

      <Section title="Need advice about your situation?">
        <p>
          Ask {card.referral}.
        </p>
      </Section>

      <div className="border-t border-line pt-4">
        <Disclaimer />
      </div>
    </article>
  );
}
