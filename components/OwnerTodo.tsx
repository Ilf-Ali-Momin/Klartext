import type { ReactNode } from "react";

// A visible placeholder for text only the owner can write. Search the code for "TODO(owner)" before launch.

export function OwnerTodo({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-warn/50 bg-warn-bg px-4 py-3 text-sm text-warn">
      <span className="font-semibold">TODO for the owner: </span>
      {children}
    </div>
  );
}
