"use client";

// ============================================================
// SleepQuickActions — Botones de registro rápido
// "Me voy a dormir" / "Me desperté"
// ============================================================

import { Moon, Sun, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SleepLogEntry } from "@/lib/sleep";

type Props = {
  pendingLog: SleepLogEntry | null;
  todaySleep: SleepLogEntry | null;
  onBedTime: () => Promise<void>;
  onWakeTime: () => Promise<void>;
  loading: boolean;
};

export function SleepQuickActions({
  pendingLog,
  todaySleep,
  onBedTime,
  onWakeTime,
  loading,
}: Props) {
  // Estado completo — sueño de hoy registrado con wakeTime
  const isComplete = !!todaySleep?.wakeTime;

  // Estado pendiente — hay bedTime pero falta wakeTime
  const isPending = !!pendingLog;

  if (isComplete) {
    return (
      <div className="card flex items-center gap-3 py-4">
        <div className="flex-shrink-0 w-10 h-10 rounded-full bg-module-sleep/20 flex items-center justify-center">
          <Check className="w-5 h-5 text-module-sleep" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-medium text-[var(--text-primary)] text-sm">
            Sueño registrado ✓
          </p>
          <p className="text-xs text-[var(--text-muted)]">
            Podés editar el registro desde el historial
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {isPending ? (
        // Modo despertar — hay bedTime activo
        <div className="space-y-3">
          <div className="card bg-module-sleep/5 border border-module-sleep/20 py-3">
            <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
              <Moon className="w-4 h-4 text-module-sleep" />
              <span>
                Te fuiste a dormir a las{" "}
                <span className="font-semibold text-[var(--text-primary)]">
                  {new Date(pendingLog!.bedTime).toLocaleTimeString("es-AR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </span>
              </span>
            </div>
          </div>
          <button
            onClick={onWakeTime}
            disabled={loading}
            className={cn(
              "w-full flex items-center justify-center gap-3 py-5 rounded-2xl",
              "font-semibold text-lg text-white transition-all active:scale-95",
              "bg-gradient-to-r from-amber-400 to-orange-400",
              "shadow-lg shadow-orange-500/20",
              loading && "opacity-60 cursor-not-allowed"
            )}
          >
            {loading ? (
              <Loader2 className="w-6 h-6 animate-spin" />
            ) : (
              <Sun className="w-6 h-6" />
            )}
            Me desperté
          </button>
        </div>
      ) : (
        // Modo inicial — registrar hora de dormir
        <button
          onClick={onBedTime}
          disabled={loading}
          className={cn(
            "w-full flex items-center justify-center gap-3 py-5 rounded-2xl",
            "font-semibold text-lg text-white transition-all active:scale-95",
            "bg-gradient-to-r from-violet-600 to-purple-600",
            "shadow-lg shadow-violet-500/20",
            loading && "opacity-60 cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 className="w-6 h-6 animate-spin" />
          ) : (
            <Moon className="w-6 h-6" />
          )}
          Me voy a dormir
        </button>
      )}
    </div>
  );
}
