"use client";

import { AlertTriangle, Clock } from "lucide-react";

type Props = {
  message: string;
  expectedTime?: string;
};

export default function SmartHabitAlert({ message, expectedTime }: Props) {
  return (
    <div className="flex gap-3 p-4 rounded-2xl bg-orange-500/10 border border-orange-500/20">
      <AlertTriangle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-orange-300">Hábito no cumplido</p>
        <p className="text-sm text-orange-400/80 mt-0.5">{message}</p>
        {expectedTime && (
          <div className="flex items-center gap-1 mt-2 text-xs text-orange-400/60">
            <Clock className="w-3.5 h-3.5" />
            <span>Hora esperada: {expectedTime}</span>
          </div>
        )}
        <p className="text-xs text-orange-400/50 mt-1">
          {/* TODO: Sesión 7 — Calendar: reagendar automáticamente */}
          Reagendado automático disponible en próxima sesión
        </p>
      </div>
    </div>
  );
}
