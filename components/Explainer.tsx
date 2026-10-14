"use client";

import { useState } from "react";
import { LetterCard } from "@/components/LetterCard";
import { Uploader, type UploadPayload } from "@/components/Uploader";
import { todayInGermany } from "@/lib/deadline";
import type { EnrichedCard } from "@/lib/llm/explain";

// Upload, explain and show the result. The card lives only in this component's state.

type State =
  | { status: "idle" }
  | { status: "loading" }
  | { status: "done"; card: EnrichedCard }
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
        setState({ status: "done", card: body.card as EnrichedCard });
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
    const { card } = state;
    return (
      <div className="space-y-4">
        {card.readable ? (
          <LetterCard card={card} today={todayInGermany()} />
        ) : (
          <div className="space-y-3 rounded-2xl border border-line bg-surface p-5">
            <h2 className="text-lg font-semibold">We couldn&apos;t read this letter</h2>
            {card.unreadable_reason && <p>{card.unreadable_reason}</p>}
            <p className="font-medium">Tips for a better photo:</p>
            <ul className="list-disc space-y-1 pl-5">
              <li>Lay the letter on a flat surface.</li>
              <li>Use good light and avoid shadows and glare.</li>
              <li>Get the whole page in the frame, with all four corners visible.</li>
            </ul>
            <p className="text-sm text-muted">This did not use up your letter.</p>
          </div>
        )}
        <button
          type="button"
          onClick={reset}
          className="w-full rounded-xl border border-line px-5 py-3 font-semibold hover:bg-subtle print:hidden"
        >
          {card.readable ? "Explain another letter" : "Try again"}
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <Uploader key={uploadKey} busy={state.status === "loading"} onSubmit={explain} />
      {state.status === "loading" && (
        <p className="text-center text-sm text-muted" aria-live="polite">
          Reading and explaining your letter. This usually takes 10 to 20 seconds.
        </p>
      )}
      {state.status === "error" && (
        <div role="alert" className="space-y-2 rounded-xl bg-danger-bg px-4 py-3 text-danger">
          <p>{state.message}</p>
          {state.buyUrl && (
            <a href={state.buyUrl} className="inline-block font-semibold underline">
              See letter packs
            </a>
          )}
        </div>
      )}
    </div>
  );
}
