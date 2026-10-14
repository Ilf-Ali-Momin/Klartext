import Link from "next/link";

export function Footer() {
  return (
    <footer className="border-t border-line print:hidden">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-3 px-4 py-6 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>Briefklar explains letters. It does not give legal advice.</p>
        <nav aria-label="Legal" className="flex gap-4">
          <Link href="/buy" className="hover:underline">
            Letter packs
          </Link>
          <Link href="/impressum" className="hover:underline">
            Impressum
          </Link>
          <Link href="/datenschutz" className="hover:underline">
            Datenschutz
          </Link>
        </nav>
      </div>
    </footer>
  );
}
