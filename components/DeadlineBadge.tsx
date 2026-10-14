"use client";

import type { EnrichedCard } from "@/lib/llm/explain";
import { buildIcs } from "@/lib/ics";
import { formatDate, relativeDays } from "@/lib/format";

function downloadIcs(date: string, card: EnrichedCard) {
  const ics = buildIcs({
    date,
    title: `Deadline: ${card.letter_type}`,
    description: [`Letter from ${card.sender.name}.`, ...card.what_they_want].join("\n"),
  });
  const url = URL.createObjectURL(new Blob([ics], { type: "text/calendar;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = "letter-deadline.ics";
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function DeadlineBadge({ card, today }: { card: EnrichedCard; today: string }) {
  const { deadline } = card;
  const date = deadline.kind === "fixed" ? deadline.date : deadline.estimated_date;
  const estimated = deadline.kind === "relative" && date !== null;

  return (
    <section aria-labelledby="deadline-heading" className="space-y-3">
      <h2 id="deadline-heading" className="text-sm font-semibold uppercase tracking-wide text-muted">
        Deadline
      </h2>
      {deadline.kind === "none" ? (
        <p className="text-lg">This letter does not set a deadline.</p>
      ) : date ? (
        <div className="space-y-1">
          <p className="text-2xl font-semibold leading-tight sm:text-3xl">{formatDate(date)}</p>
          <p className="text-muted">{relativeDays(date, today)}</p>
          {estimated && (
            <p className="text-sm font-medium text-warn">Estimated. Counted from the letter date to be safe.</p>
          )}
        </div>
      ) : (
        <p className="text-lg">
          The letter sets a deadline, but no date can be worked out from it. Check when you received the letter.
        </p>
      )}
      {(deadline.translation || deadline.original_text) && (
        <div className="rounded-xl bg-subtle p-3 text-sm">
          {deadline.translation && <p>“{deadline.translation}”</p>}
          {deadline.original_text && (
            <p lang="de" className="mt-1 text-muted">
              German: “{deadline.original_text}”
            </p>
          )}
        </div>
      )}
      {date && (
        <button
          type="button"
          onClick={() => downloadIcs(date, card)}
          className="rounded-lg border border-line px-4 py-2 font-medium hover:bg-subtle print:hidden"
        >
          Add to calendar
        </button>
      )}
    </section>
  );
}
