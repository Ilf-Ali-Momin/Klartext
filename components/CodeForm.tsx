"use client";

import { useState, type FormEvent } from "react";

// Lets a buyer use their credit code on this device, for example after switching phones.

export function CodeForm({ onSaved }: { onSaved?: (creditsLeft: number) => void }) {
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<{ ok: boolean; message: string } | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setStatus(null);
    try {
      const response = await fetch("/api/code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ code }),
      });
      const body = await response.json().catch(() => null);
      if (response.ok && typeof body?.credits_left === "number") {
        const left = body.credits_left as number;
        setStatus({ ok: true, message: `Code saved on this device. ${left} ${left === 1 ? "letter" : "letters"} left.` });
        onSaved?.(left);
      } else {
        setStatus({ ok: false, message: body?.message ?? "Something went wrong. Please try again." });
      }
    } catch {
      setStatus({ ok: false, message: "We couldn't reach the server. Check your connection and try again." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-2">
      <label htmlFor="credit-code" className="block text-sm font-medium">
        Your code
      </label>
      <div className="flex gap-2">
        <input
          id="credit-code"
          value={code}
          onChange={(event) => setCode(event.target.value)}
          placeholder="ABCDE-FGHJK"
          autoComplete="off"
          autoCapitalize="characters"
          spellCheck={false}
          className="min-w-0 flex-1 rounded-lg border border-line bg-surface px-3 py-2 font-mono uppercase"
        />
        <button
          type="submit"
          disabled={busy || code.trim().length === 0}
          className="rounded-lg border border-line px-4 py-2 font-medium hover:bg-subtle disabled:opacity-50"
        >
          {busy ? "Checking…" : "Use code"}
        </button>
      </div>
      {status && (
        <p role="status" className={`text-sm ${status.ok ? "text-ok" : "text-danger"}`}>
          {status.message}
        </p>
      )}
    </form>
  );
}
