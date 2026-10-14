import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          Klartext is a personal project, not a commercial service. It explains letters and does not give legal
          advice.
        </p>
        <nav aria-label="Site" className="flex shrink-0 gap-4">
          <Link href="/buy" className="hover:underline">
            Letter packs
          </Link>
        </nav>
      </div>
    </footer>
  );
}
