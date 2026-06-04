"use client";
import { useState, type ReactNode } from "react";

export default function ActivityStatsDisclosure({ children }: { children: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex justify-between items-center glass-card rounded-xl px-4 py-3 text-sm font-semibold text-on-surface"
      >
        <span>Más stats</span>
        <span className="material-symbols-outlined text-[18px]">{open ? "expand_less" : "expand_more"}</span>
      </button>
      {open && <div className="space-y-3">{children}</div>}
    </div>
  );
}
