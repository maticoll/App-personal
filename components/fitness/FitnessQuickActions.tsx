"use client";

import Link from "next/link";
import { ACTIVITY_ORDER, ACTIVITIES } from "@/lib/fitness-activities";

type Props = { onLogged: () => void };

export default function FitnessQuickActions({ onLogged: _ }: Props) {
  return (
    <div className="glass-card rounded-2xl p-4 space-y-3">
      <span className="text-xs font-bold text-on-surface-variant uppercase tracking-widest">
        Registrar actividad
      </span>
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {ACTIVITY_ORDER.map((slug) => {
          const a = ACTIVITIES[slug];
          return (
            <Link
              key={slug}
              href={`/fitness/${slug}`}
              className="flex-shrink-0 flex flex-col items-center gap-1.5 px-4 py-2.5 rounded-xl transition-all active:scale-90"
              style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: a.color }}
            >
              <span className="material-symbols-outlined text-[22px]">{a.icon}</span>
              <span className="text-[11px] font-semibold">{a.label}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
