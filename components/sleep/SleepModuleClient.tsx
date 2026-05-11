"use client";

// ============================================================
// SleepModuleClient — Componente cliente principal del módulo
// Orquesta el estado, las acciones y todos los sub-componentes
// ============================================================

import { useState, useCallback } from "react";
import { BarChart2, List, Moon } from "lucide-react";
import { cn } from "@/lib/utils";
import { SleepQuickActions } from "./SleepQuickActions";
import { SleepTodayCard } from "./SleepTodayCard";
import { SleepWeekStats } from "./SleepWeekStats";
import { SleepDurationChart } from "./SleepDurationChart";
import { SleepQualityChart } from "./SleepQualityChart";
import { SleepTimingChart } from "./SleepTimingChart";
import { SleepHistoryList } from "./SleepHistoryList";
import { GarminSyncButton } from "./GarminSyncButton";
import type { SleepLogEntry, WeeklyStats } from "@/lib/sleep";

type Tab = "charts" | "history";

type Props = {
  initialToday: SleepLogEntry | null;
  initialPending: SleepLogEntry | null;
  initialHistory: SleepLogEntry[];
  initialStats: WeeklyStats;
  garminConnected: boolean;
  garminLastSync: Date | null;
};

export function SleepModuleClient({
  initialToday,
  initialPending,
  initialHistory,
  initialStats,
  garminConnected,
  garminLastSync,
}: Props) {
  const [activeTab, setActiveTab] = useState<Tab>("charts");
  const [loading, setLoading] = useState(false);

  // State — se actualiza con las acciones del usuario
  const [today, setToday] = useState<SleepLogEntry | null>(initialToday);
  const [pending, setPending] = useState<SleepLogEntry | null>(initialPending);
  const [history, setHistory] = useState<SleepLogEntry[]>(initialHistory);
  const [stats, setStats] = useState<WeeklyStats>(initialStats);

  // Recargar datos frescos desde la API
  const refreshData = useCallback(async () => {
    const [todayRes, historyRes] = await Promise.all([
      fetch("/api/sleep/today").then((r) => r.json()),
      fetch("/api/sleep/history?days=14").then((r) => r.json()),
    ]);
    if (todayRes.today) setToday(todayRes.today);
    if (todayRes.pending !== undefined) setPending(todayRes.pending);
    if (historyRes.history) setHistory(historyRes.history);
    if (historyRes.weeklyStats) setStats(historyRes.weeklyStats);
  }, []);

  // --- Acciones ---

  const handleBedTime = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sleep/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bed" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al registrar");
      }
      const data = await res.json();
      setPending(data.log);
      // Actualizar historial
      await refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar hora de dormir");
    } finally {
      setLoading(false);
    }
  };

  const handleWakeTime = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/sleep/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "wake" }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Error al registrar");
      }
      setPending(null);
      await refreshData();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Error al registrar hora de despertar");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    const res = await fetch(`/api/sleep/${id}`, { method: "DELETE" });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error al eliminar");
    }
    setHistory((prev) => prev.filter((l) => l.id !== id));
    if (today?.id === id) setToday(null);
    if (pending?.id === id) setPending(null);
  };

  const handleGarminSync = async () => {
    const res = await fetch("/api/sleep/sync-garmin", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ days: 7 }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error ?? "Error de sync");
    }
    const result = await res.json();
    await refreshData();
    return {
      synced: result.synced ?? 0,
      errors: result.errors ?? 0,
      skipped: result.skipped ?? 0,
    };
  };

  // La data "de hoy" puede ser el registro pendiente o el completado
  const displayedToday = today ?? (pending?.bedTime ? pending : null);

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      <SleepQuickActions
        pendingLog={pending}
        todaySleep={today}
        onBedTime={handleBedTime}
        onWakeTime={handleWakeTime}
        loading={loading}
      />

      {/* Card de hoy (si hay datos) */}
      {displayedToday && (
        <SleepTodayCard log={displayedToday} />
      )}

      {/* Stats semanales */}
      {stats.totalDays > 0 && <SleepWeekStats stats={stats} />}

      {/* Tabs: Gráficos | Historial */}
      <div className="flex rounded-xl border border-[var(--border)] overflow-hidden">
        {(
          [
            { id: "charts", label: "Gráficos", icon: BarChart2 },
            { id: "history", label: "Historial", icon: List },
          ] as { id: Tab; label: string; icon: React.ComponentType<{ className?: string }> }[]
        ).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={cn(
              "flex-1 flex items-center justify-center gap-2 py-2.5 text-sm font-medium transition-all",
              activeTab === id
                ? "bg-module-sleep/15 text-module-sleep"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            )}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* Contenido del tab */}
      {activeTab === "charts" ? (
        <div className="space-y-4">
          {history.length === 0 ? (
            <div className="card text-center py-10">
              <Moon className="w-10 h-10 text-module-sleep mx-auto mb-3 opacity-30" />
              <p className="text-sm font-medium text-[var(--text-primary)]">
                Sin datos de sueño aún
              </p>
              <p className="text-xs text-[var(--text-muted)] mt-1">
                Registrá tu primer sueño con el botón de arriba
              </p>
            </div>
          ) : (
            <>
              <SleepDurationChart history={history} days={7} />
              <SleepQualityChart history={history} />
              <SleepTimingChart history={history} />
              <GarminSyncButton
                isConnected={garminConnected}
                lastSync={garminLastSync}
                onSync={handleGarminSync}
              />
            </>
          )}
        </div>
      ) : (
        <SleepHistoryList history={history} onDelete={handleDelete} />
      )}
    </div>
  );
}
