"use client";

import Link from "next/link";
import { useState } from "react";
import { PrinterIcon } from "@/components/Icons";
import { LetterCard } from "@/components/LetterCard";
import { Uploader, type UploadPayload } from "@/components/Uploader";
import { todayInGermany } from "@/lib/deadline";
import { formatDate } from "@/lib/format";
import type { EnrichedCard } from "@/lib/llm/explain";

// Upload, explain and show the result. The card lives only in this component's state.

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; card: EnrichedCard; creditsLeft?: number; demo: boolean }
  | { status: "error"; message: string; buyUrl?: string };

export function Explainer() {
  const [state, setState] = useState<State>({ status: "idle" });
  const [uploadKey, setUploadKey] = useState(0);

  async function explain(payload: UploadPayload) {
    setState({ status: "loading" });
    try {
      const response = await fetch("/api/explain", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && body?.card) {
        setState({
          status: "done",
          card: body.card as EnrichedCard,
          creditsLeft: typeof body.credits_left === "number" ? body.credits_left : undefined,
          demo: body.demo === true,
        });
      } else {
        setState({
          status: "error",
          message: body?.message ?? "Something went wrong. Please try again.",
          buyUrl: body?.buy_url,
        });
      }
    } catch {
      setState({ status: "error", message: "We couldn't reach the server. Check your connection and try again." });
    }
  }

  function reset() {
    setState({ status: "idle" });
    setUploadKey((key) => key + 1);
  }

  if (state.status === "done") {
    const { card, creditsLeft, demo } = state;
    return (
      <div className="space-y-4" data-result>
        {demo && (
          <p role="note" className="rounded-[4px] border-l-4 border-warn bg-warn-bg px-4 py-3 text-sm font-medium text-warn">
            Demo mode: a fixed example, not made from your upload.
          </p>
        )}
        {card.readable ? (
          <div data-print-card className="space-y-2">
            <p className="hidden text-sm print:block">
              Explained by Klartext on {formatDate(todayInGermany())}. Check important details against the original
              letter.
            </p>
            <LetterCard card={card} today={todayInGermany()} />
          </div>
        ) : (
          <div className="space-y-4 rounded-[4px] bg-surface p-6 shadow-[0_1px_0_var(--line),0_18px_40px_-24px_rgba(20,24,43,0.5)]">
            <h2 className="font-display text-3xl font-bold leading-tight">We couldn&apos;t read this one</h2>
            {card.unreadable_reason && <p className="text-muted">{card.unreadable_reason}</p>}
            <ul className="space-y-2">
              <li>Lay the letter flat.</li>
              <li>Use good light, no shadows or glare.</li>
              <li>Get all four corners in the frame.</li>
            </ul>
            <p className="text-sm font-medium text-ok">This didn&apos;t use up a letter.</p>
          </div>
        )}
        {creditsLeft !== undefined && (
          <p className="text-sm text-muted print:hidden">
            {creditsLeft} {creditsLeft === 1 ? "letter" : "letters"} left on your code.
          </p>
        )}
        <div className="flex flex-col gap-3 sm:flex-row print:hidden">
          <button
            type="button"
            onClick={reset}
            className="flex-1 rounded-[6px] bg-accent px-5 py-3 font-display text-xl font-bold text-on-accent hover:bg-accent/90"
          >
            {card.readable ? "Explain another letter" : "Try again"}
          </button>
          {card.readable && (
            <button
              type="button"
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 rounded-[6px] border-2 border-line px-5 py-3 font-semibold hover:bg-surface"
            >
              <PrinterIcon /> Print or save as PDF
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Uploader key={uploadKey} busy={state.status === "loading"} onSubmit={explain} />
      {state.status === "loading" && (
        <p className="text-lg font-medium" aria-live="polite">
          <span className="marker marker-loop">Reading your letter</span>
          <span className="mt-1 block text-sm font-normal text-muted">This takes 10 to 20 seconds.</span>
        </p>
      )}
      {state.status === "error" && (
        <div role="alert" className="space-y-2 rounded-[4px] border-l-4 border-danger bg-danger-bg px-4 py-3 text-danger">
          <p className="font-medium">{state.message}</p>
          {state.buyUrl && (
            <Link href={state.buyUrl} className="inline-block font-semibold underline">
              See letter packs
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
