// ============================================================
// /sleep — Módulo de Sueño
// Sesión 3 — Implementación completa
//
// Server Component: carga datos en paralelo y pasa al Client
// ============================================================

import { Moon } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getTodaySleep, getPendingSleepLog, getSleepHistory, getWeeklyStats } from "@/lib/sleep";
import { checkGarminStatus } from "@/lib/garmin";
import { SleepModuleClient } from "@/components/sleep/SleepModuleClient";

export default async function SleepPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Cargar todo en paralelo
  const [today, pending, history, stats, garminStatus] = await Promise.all([
    getTodaySleep(userId),
    getPendingSleepLog(userId),
    getSleepHistory(userId, 14),
    getWeeklyStats(userId),
    checkGarminStatus(userId),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Moon className="w-5 h-5 text-module-sleep" />
          <h2 className="text-xl font-bold text-on-surface">
            Sueño
          </h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Registro y análisis de tu descanso
        </p>
      </div>

      {/* Módulo cliente — maneja estado, acciones y charts */}
      <SleepModuleClient
        initialToday={today}
        initialPending={pending}
        initialHistory={history}
        initialStats={stats}
        garminConnected={garminStatus.connected && garminStatus.sessionValid}
        garminLastSync={garminStatus.lastSync}
      />
    </div>
  );
}
