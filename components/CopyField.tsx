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
        <div className="text-xs uppercase tracking-wide text-muted">{label}</div>
        <div className={`break-all select-all ${mono ? "font-mono text-[0.95rem]" : ""}`}>{value}</div>
      </div>
      <button
        type="button"
        onClick={copy}
        className="shrink-0 rounded-lg border border-line px-3 py-1.5 text-sm font-medium hover:bg-subtle print:hidden"
        aria-label={`Copy ${label}`}
      >
        {copied ? "Copied" : "Copy"}
      </button>
    </div>
  );
}
