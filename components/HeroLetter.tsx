import { formatDate, formatEuro } from "@/lib/format";
import { SAMPLE_CARD } from "@/lib/sample-card";

// The hero illustration: a fictional German letter with the deadline and amount highlighted, and the plain
// English meaning on a note on top. All names and numbers are fictional (lib/sample-card.ts).

export function HeroLetter() {
  const due = SAMPLE_CARD.deadline.estimated_date;
  return (
    <figure className="relative mx-auto w-full max-w-[25rem] pb-16 sm:pb-20" aria-label="Example: a German letter and its plain English meaning">
      <div
        lang="de"
        className="relative -rotate-2 rounded-[3px] bg-white px-6 pb-7 pt-5 text-[0.82rem] leading-relaxed text-[#2a2f45] shadow-[0_1px_0_#c9cfdb,0_18px_40px_-18px_rgba(20,24,43,0.45)]"
      >
        <p className="text-[0.68rem] text-[#6b7186]">Muster Inkasso GmbH · Hafenstraße 99 · 54321 Beispielburg</p>
        <div className="mt-2 w-44 rounded-[2px] border border-dashed border-[#c3c9d6] px-2 py-1.5 text-[0.72rem] leading-snug text-[#4a5068]">
          Herrn Tomás Probe
          <br />
          Birkenstraße 7
          <br />
          12345 Musterstadt
        </div>
        <p className="mt-4 font-semibold text-[#14182b]">Forderung aus Mobilfunkvertrag</p>
        <p className="mt-2">
          Bitte zahlen Sie den Gesamtbetrag von{" "}
          <mark className="marker marker-sweep" style={{ animationDelay: "0.5s" }}>
            97,35 Euro
          </mark>{" "}
          <mark className="marker marker-sweep" style={{ animationDelay: "1.1s" }}>
            innerhalb von 14 Tagen
          </mark>{" "}
          ab Datum dieses Schreibens.
        </p>
        <p className="mt-2 text-[#6b7186]">
          Sollte die Zahlung nicht fristgerecht eingehen, behalten wir uns vor, das gerichtliche Mahnverfahren
          einzuleiten.
        </p>
      </div>
      <figcaption
        className="note-in absolute -bottom-2 right-0 w-[78%] rounded-[4px] bg-accent px-5 py-4 text-on-accent shadow-[0_16px_32px_-14px_rgba(20,24,43,0.55)]"
        style={{ animationDelay: "1.9s" }}
      >
        <span className="block font-display text-2xl font-bold leading-tight">
          Pay {formatEuro(SAMPLE_CARD.amount?.value ?? 0)} within 14 days.
        </span>
        {due && <span className="mt-1 block text-sm opacity-85">Due by {formatDate(due)}</span>}
      </figcaption>
    </figure>
  );
}
