"use client";

import type { EnrichedCard } from "@/lib/llm/explain";
import { CalendarIcon } from "@/components/Icons";
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

export function DeadlineBadge({ card, today, reason }: { card: EnrichedCard; today: string; reason: string }) {
  const { deadline } = card;
  const date = deadline.kind === "fixed" ? deadline.date : deadline.estimated_date;
  const estimated = deadline.kind === "relative" && date !== null;

  return (
    <section aria-labelledby="deadline-heading" className="break-inside-avoid space-y-3">
      <h2 id="deadline-heading" className="sr-only">
        Deadline
      </h2>
      {deadline.kind === "none" ? (
        <p className="font-display text-2xl font-bold">No deadline in this letter.</p>
      ) : date ? (
        <div>
          <p className="text-sm text-muted">{estimated ? "Deadline, estimated" : "Deadline"}</p>
          <p className="mt-1 font-display text-4xl font-extrabold leading-[1.05] sm:text-5xl">
            <span className="marker">{formatDate(date)}</span>
          </p>
          <p className="mt-2 font-semibold">{relativeDays(date, today)}</p>
          {estimated && (
            <p className="mt-1 text-sm text-warn">Estimated. Counted from the letter date to be safe.</p>
          )}
        </div>
      ) : (
        <p className="text-lg">
          The letter sets a deadline, but no date can be worked out from it. Check when you received the letter.
        </p>
      )}
      <p className="text-sm text-muted">{reason}</p>
      {(deadline.translation || deadline.original_text) && (
        <blockquote className="border-l-4 border-accent/40 pl-3 text-sm">
          {deadline.translation && <p>“{deadline.translation}”</p>}
          {deadline.original_text && (
            <p lang="de" className="mt-1 text-muted">
              “{deadline.original_text}”
            </p>
          )}
        </blockquote>
      )}
      {date && (
        <button
          type="button"
          onClick={() => downloadIcs(date, card)}
          className="inline-flex items-center gap-2 rounded-[6px] border-2 border-accent px-4 py-2 font-semibold text-accent hover:bg-accent/10 print:hidden"
        >
          <CalendarIcon /> Add to calendar
        </button>
      )}
    </section>
  );
}
