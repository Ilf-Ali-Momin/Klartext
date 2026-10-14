import type { Metadata } from "next";
import Link from "next/link";
import { OwnerTodo } from "@/components/OwnerTodo";

export const metadata: Metadata = { title: "Datenschutz · Briefklar" };

// TODO(owner): Replace every placeholder on this page with your real privacy policy (Datenschutzerklärung)
// before launch. docs/data-flows.md lists, as technical facts,
// what data the app processes, where it goes and how long it stays. Use it as input for whoever writes the policy.

export default function DatenschutzPage() {
  return (
    <main className="mx-auto w-full max-w-2xl flex-1 space-y-6 px-4 py-10 sm:py-16">
      <Link href="/" className="text-sm text-muted hover:underline">
        ← Back
      </Link>
      <h1 className="text-3xl font-semibold tracking-tight">Datenschutz</h1>

      <OwnerTodo>Add the privacy policy (Datenschutzerklärung) for this service. It has not been written yet.</OwnerTodo>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Controller</h2>
        <OwnerTodo>Who is responsible for data processing, with contact details.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Letters you upload</h2>
        <OwnerTodo>How uploaded letters are processed, by whom, and on which legal basis.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Payments</h2>
        <OwnerTodo>How payments through Stripe are processed.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Cookies and abuse protection</h2>
        <OwnerTodo>The two cookies and the hashed IP counter, and why they are used.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Service providers</h2>
        <OwnerTodo>Hosting, database, AI and payment providers, and the agreements with them.</OwnerTodo>
      </section>

      <section className="space-y-2">
        <h2 className="text-lg font-semibold">Your rights</h2>
        <OwnerTodo>The rights of the people whose data is processed, and how to use them.</OwnerTodo>
      </section>
    </main>
  );
}
