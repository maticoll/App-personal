"use client";
import { Check } from "lucide-react";

type Props = {
  index: number;
  prev: { weightKg: number | null; reps: number | null } | null;
  weightKg: number | null;
  reps: number | null;
  done: boolean;
  onChange: (patch: { weightKg?: number | null; reps?: number | null }) => void;
  onToggleDone: () => void;
};

export default function SetRow({ index, prev, weightKg, reps, done, onChange, onToggleDone }: Props) {
  const prevText =
    prev && (prev.weightKg != null || prev.reps != null)
      ? `${prev.weightKg ?? "—"}×${prev.reps ?? "—"}`
      : "—";

  return (
    <div
      className={`grid items-center gap-2 px-2 py-1.5 rounded-lg text-sm ${
        done ? "bg-[rgba(16,185,129,0.10)]" : ""
      }`}
      style={{ gridTemplateColumns: "28px 1fr 56px 48px 32px" }}
    >
      <span className="text-center text-on-surface-variant font-medium">{index}</span>
      <span className="text-outline text-xs truncate">{prevText}</span>
      <input
        type="number"
        inputMode="decimal"
        value={weightKg ?? ""}
        placeholder="kg"
        onChange={(e) =>
          onChange({ weightKg: e.target.value === "" ? null : parseFloat(e.target.value) })
        }
        className="w-full bg-surface-container-high text-on-surface text-center rounded-md px-1 py-1 outline-none focus:ring-1 focus:ring-accent-cyan"
      />
      <input
        type="number"
        inputMode="numeric"
        value={reps ?? ""}
        placeholder="reps"
        onChange={(e) =>
          onChange({ reps: e.target.value === "" ? null : parseInt(e.target.value, 10) })
        }
        className="w-full bg-surface-container-high text-on-surface text-center rounded-md px-1 py-1 outline-none focus:ring-1 focus:ring-accent-cyan"
      />
      <button
        onClick={onToggleDone}
        aria-label={done ? "Marcar serie como no hecha" : "Marcar serie como hecha"}
        className={`flex items-center justify-center w-7 h-7 rounded-md transition-colors ${
          done
            ? "bg-[#10B981]/20 text-[#10B981]"
            : "bg-surface-container-high text-outline hover:text-on-surface"
        }`}
      >
        <Check className="w-4 h-4" />
      </button>
    </div>
  );
}
