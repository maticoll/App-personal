"use client";

import { useState, useCallback } from "react";
import type {
  WorkoutWithExercises,
  GymRoutineWithExercises,
  WeeklyStatEntry,
  SmartHabitStatus,
} from "@/lib/fitness";

import TodayWorkoutCard from "./TodayWorkoutCard";
import GymRoutineCard from "./GymRoutineCard";
import FitnessQuickActions from "./FitnessQuickActions";
import WeeklyVolumeChart from "./WeeklyVolumeChart";
import WorkoutHistoryList from "./WorkoutHistoryList";
import RoutineManager from "./RoutineManager";
import SmartHabitAlert from "./SmartHabitAlert";
import GarminSyncButton from "./GarminSyncButton";

type Tab = "hoy" | "stats" | "rutinas";

type Props = {
  initialTodayWorkouts: WorkoutWithExercises[];
  initialHistory: WorkoutWithExercises[];
  initialWeeklyStats: WeeklyStatEntry[];
  initialTodayRoutine: GymRoutineWithExercises | null;
  initialSmartHabit: SmartHabitStatus;
  garminConnected: boolean;
};

export default function FitnessModuleClient({
  initialTodayWorkouts,
  initialHistory,
  initialWeeklyStats,
  initialTodayRoutine,
  initialSmartHabit,
  garminConnected,
}: Props) {
  const [tab, setTab] = useState<Tab>("hoy");
  const [todayWorkouts, setTodayWorkouts] =
    useState<WorkoutWithExercises[]>(initialTodayWorkouts);
  const [history, setHistory] = useState<WorkoutWithExercises[]>(initialHistory);
  const [weeklyStats, setWeeklyStats] =
    useState<WeeklyStatEntry[]>(initialWeeklyStats);
  const [smartHabit, setSmartHabit] =
    useState<SmartHabitStatus>(initialSmartHabit);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [todayRes, historyRes, weekRes, habitRes] = await Promise.all([
        fetch("/api/fitness/today"),
        fetch("/api/fitness/workout?days=14"),
        fetch("/api/fitness/weekly-stats"),
        fetch("/api/fitness/today"),
      ]);

      if (todayRes.ok) {
        const d = await todayRes.json();
        setTodayWorkouts(d.workouts ?? []);
        setSmartHabit(d.smartHabit ?? { shouldNotify: false });
      }
      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.workouts ?? []);
      }
      if (weekRes.ok) {
        const d = await weekRes.json();
        setWeeklyStats(d.stats ?? []);
      }
      // habitRes shares same response as todayRes, already handled
      void habitRes;
    } catch {
      // silently fail — data stays as-is
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const refreshStats = useCallback(async () => {
    try {
      const res = await fetch("/api/fitness/weekly-stats");
      if (res.ok) {
        const d = await res.json();
        setWeeklyStats(d.stats ?? []);
      }
    } catch {
      // silently fail
    }
  }, []);

  const handleWorkoutDeleted = useCallback((id: string) => {
    setTodayWorkouts((prev) => prev.filter((w) => w.id !== id));
    setHistory((prev) => prev.filter((w) => w.id !== id));
    refreshStats();
  }, [refreshStats]);

  const handleLogged = useCallback(() => {
    refreshAll();
  }, [refreshAll]);

  const TABS: { id: Tab; label: string }[] = [
    { id: "hoy", label: "Hoy" },
    { id: "stats", label: "Stats" },
    { id: "rutinas", label: "Rutinas" },
  ];

  return (
    <div className="space-y-4">
      {/* Smart Habit Alert */}
      {smartHabit.shouldNotify && (
        <SmartHabitAlert message={smartHabit.message ?? ""} />
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-[var(--surface-hover)] rounded-xl p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 rounded-lg text-sm font-medium transition-colors ${
              tab === t.id
                ? "bg-[var(--surface)] text-[var(--text-primary)] shadow-sm"
                : "text-[var(--text-muted)] hover:text-[var(--text-secondary)]"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ─── TAB: HOY ─── */}
      {tab === "hoy" && (
        <div className="space-y-4">
          {/* Rutina del día */}
          {initialTodayRoutine && (
            <GymRoutineCard
              routine={initialTodayRoutine}
              onStarted={handleLogged}
            />
          )}

          {/* Registrar actividad */}
          <FitnessQuickActions onLogged={handleLogged} />

          {/* Entrenamientos de hoy */}
          {todayWorkouts.length > 0 && (
            <TodayWorkoutCard
              workouts={todayWorkouts}
              onDeleted={handleWorkoutDeleted}
              isRefreshing={isRefreshing}
            />
          )}

          {/* Garmin sync — al fondo */}
          <GarminSyncButton
            garminStatus={{ connected: garminConnected, sessionValid: garminConnected, lastSync: null }}
            onSynced={handleLogged}
          />
        </div>
      )}

      {/* ─── TAB: STATS ─── */}
      {tab === "stats" && (
        <div className="space-y-4">
          <WeeklyVolumeChart data={weeklyStats} />
          <div className="space-y-2">
            <h3 className="text-sm font-semibold text-[var(--text-primary)] px-1">
              Últimos 14 días
            </h3>
            <WorkoutHistoryList
              workouts={history}
              onDeleted={handleWorkoutDeleted}
            />
          </div>
        </div>
      )}

      {/* ─── TAB: RUTINAS ─── */}
      {tab === "rutinas" && (
        <RoutineManager onChanged={handleLogged} />
      )}
    </div>
  );
}
