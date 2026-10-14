import type { Metadata } from "next";
import Link from "next/link";
import { OwnerTodo } from "@/components/OwnerTodo";

export const metadata: Metadata = { title: "Impressum · Briefklar" };

// TODO(owner): Replace every placeholder on this page with your real legal notice before launch.

export default function ImpressumPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← Back
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Impressum</h1>

      <OwnerTodo>Add the legal notice (Impressum) for this service. It has not been written yet.</OwnerTodo>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Provider</h2>
        <OwnerTodo>Name and postal address of the provider.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Contact</h2>
        <OwnerTodo>Contact details, for example an email address.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Further details</h2>
        <OwnerTodo>Any further details your legal adviser says this notice needs.</OwnerTodo>
      </section>
    </main>
  );
}
