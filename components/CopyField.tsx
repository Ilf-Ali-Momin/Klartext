"use client";

import { useState } from "react";

export function CopyField({ label, value, mono = true }: { label: string; value: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard can be blocked. The value stays selectable.
    }
  }

  return (
    <div className="flex items-center justify-between gap-3 py-2">
      <div className="min-w-0">
        <div className="text-sm text-muted">{label}</div>
        <div className={`[overflow-wrap:anywhere] select-all ${mono ? "font-mono text-[0.95rem]" : ""}`}>{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-[6px] border-2 border-line px-3 py-1.5 text-sm font-semibold hover:border-accent hover:text-accent print:hidden"
        aria-label={`Copy ${label}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
