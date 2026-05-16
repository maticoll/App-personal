"use client";

// ============================================================
// SleepQuickActions — Botones de registro rápido
// "Me voy a dormir" / "Me desperté" + botón retro
// ============================================================

import { useState } from "react";
import { Moon, Sun, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { SleepLogEntry } from "@/lib/sleep";
import RetroSleepLogger from "./RetroSleepLogger";

type Props = {
  pendingLog: SleepLogEntry | null;
  todaySleep: SleepLogEntry | null;
  onBedTime: () => Promise<void>;
  onWakeTime: () => Promise<void>;
  loading: boolean;
  onLogged: () => void;
};

export function SleepQuickActions({
  pendingLog,
  todaySleep,
  onBedTime,
  onWakeTime,
  loading,
  onLogged,
}: Props) {
  const [showRetro, setShowRetro] = useState(false);

  const isComplete = !!todaySleep?.wakeTime;
  const isPending = !!pendingLog;

  return (
    <>
      <div className="space-y-3">
        {isComplete ? (
          <div className="card flex items-center gap-3 py-4">
            <div className="flex-shrink-0 w-10 h-10 rounded-full bg-module-sleep/20 flex items-center justify-center">
              <Check className="w-5 h-5 text-module-sleep" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-on-surface text-sm">Sueño registrado ✓</p>
              <p className="text-xs text-outline">Podés editar el registro desde el historial</p>
            </div>
          </div>
        ) : isPending ? (
          <div className="space-y-3">
            <div className="card bg-module-sleep/5 border border-module-sleep/20 py-3">
              <div className="flex items-center gap-2 text-sm text-on-surface-variant">
                <Moon className="w-4 h-4 text-module-sleep" />
                <span>
                  Te fuiste a dormir a las{" "}
                  <span className="font-semibold text-on-surface">
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
              {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Sun className="w-6 h-6" />}
              Me desperté
            </button>
          </div>
        ) : (
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
            {loading ? <Loader2 className="w-6 h-6 animate-spin" /> : <Moon className="w-6 h-6" />}
            Me voy a dormir
          </button>
        )}

        {/* Botón retroactivo — siempre visible si no hay sueño completo */}
        {!isComplete && (
          <button
            onClick={() => setShowRetro(true)}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl border border-outline-variant/20 text-on-surface-variant text-sm font-medium active:scale-95 transition-all hover:bg-surface-container"
          >
            <span className="material-symbols-outlined text-[18px]">history</span>
            Cargar sueño de ayer
          </button>
        )}
      </div>

      {/* Modal con ruedas */}
      {showRetro && (
        <RetroSleepLogger
          onLogged={onLogged}
          onClose={() => setShowRetro(false)}
        />
      )}
    </>
  );
}
