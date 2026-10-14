"use client";

import { useEffect, useState } from "react";

// Saves the code from the success page on this device. Runs on every visit, so revisiting the link works too.

export function SaveCode({ code }: { code: string }) {
  const [saved, setSaved] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/code", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ code }),
    })
      .then((response) => !cancelled && setSaved(response.ok))
      .catch(() => !cancelled && setSaved(false));
    return () => {
      cancelled = true;
    };
  }, [code]);

  if (saved === null) return <p className="text-sm text-muted">Saving the code on this device…</p>;
  return saved ? (
    <p className="text-sm text-ok">Saved on this device. You can start explaining letters now.</p>
  ) : (
    <p className="text-sm text-danger">
      We couldn&apos;t save the code on this device. Enter it on the home page under &quot;Have a code?&quot;.
    </p>
  );
}
