"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import type {
  WorkoutWithExercises,
  RoutineWithLastPerformance,
  WeeklyStatEntry,
  SmartHabitStatus,
} from "@/lib/fitness";

import TodayWorkoutCard from "./TodayWorkoutCard";
import StepsCard from "./StepsCard";
import GymRoutineCard from "./GymRoutineCard";
import FitnessQuickActions from "./FitnessQuickActions";
import WeeklyVolumeChart from "./WeeklyVolumeChart";
import WorkoutHistoryList from "./WorkoutHistoryList";
import SmartHabitAlert from "./SmartHabitAlert";
import GarminSyncButton from "./GarminSyncButton";

type Tab = "hoy" | "stats";

type StepsInfo = { steps: number; goal: number } | null;

type Props = {
  initialTodayWorkouts: WorkoutWithExercises[];
  initialHistory: WorkoutWithExercises[];
  initialWeeklyStats: WeeklyStatEntry[];
  initialTodayRoutine: RoutineWithLastPerformance | null;
  initialSmartHabit: SmartHabitStatus;
  initialSteps: StepsInfo;
  garminConnected: boolean;
};

export default function FitnessModuleClient({
  initialTodayWorkouts,
  initialHistory,
  initialWeeklyStats,
  initialTodayRoutine,
  initialSmartHabit,
  initialSteps,
  garminConnected,
}: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("hoy");
  const [todayWorkouts, setTodayWorkouts] = useState<WorkoutWithExercises[]>(initialTodayWorkouts);
  const [history, setHistory] = useState<WorkoutWithExercises[]>(initialHistory);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStatEntry[]>(initialWeeklyStats);
  const [smartHabit, setSmartHabit] = useState<SmartHabitStatus>(initialSmartHabit);
  const [steps, setSteps] = useState<StepsInfo>(initialSteps);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const refreshAll = useCallback(async () => {
    setIsRefreshing(true);
    try {
      const [todayRes, historyRes, weekRes] = await Promise.all([
        fetch("/api/fitness/today"),
        fetch("/api/fitness/workout?days=14"),
        fetch("/api/fitness/weekly-stats"),
      ]);
      if (todayRes.ok) {
        const d = await todayRes.json();
        setTodayWorkouts(d.workouts ?? []);
        setSmartHabit(d.smartHabit ?? { shouldNotify: false });
        setSteps(d.steps ?? null);
      }
      if (historyRes.ok) {
        const d = await historyRes.json();
        setHistory(d.workouts ?? []);
      }
      if (weekRes.ok) {
        const d = await weekRes.json();
        setWeeklyStats(d.stats ?? []);
      }
    } catch {
      // silently fail
    } finally {
      setIsRefreshing(false);
    }
  }, []);

  const handleWorkoutDeleted = useCallback((id: string) => {
    setTodayWorkouts((prev) => prev.filter((w) => w.id !== id));
    setHistory((prev) => prev.filter((w) => w.id !== id));
  }, []);

  const handleLogged = useCallback(() => { refreshAll(); }, [refreshAll]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-UY", { day: "numeric", month: "short" }).toUpperCase();

  const TABS = [
    { id: "hoy" as Tab, label: "Today" },
    { id: "stats" as Tab, label: "Stats" },
  ];

  return (
    <div className="space-y-5">

      {/* Smart Habit Alert */}
      {smartHabit.shouldNotify && (
        <SmartHabitAlert message={smartHabit.message ?? ""} />
      )}

      {/* ── Tab nav estilo Stitch ─────────────────────────────── */}
      <div className="flex p-1 bg-surface-container rounded-xl">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${
              tab === t.id
                ? "text-accent-cyan bg-surface-container-high shadow-[0_0_12px_rgba(6,182,212,0.3)]"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── TODAY ────────────────────────────────────────────── */}
      {tab === "hoy" && (
        <div className="space-y-4">
          {/* Daily Focus heading */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-on-surface tracking-tight">Daily Focus</h2>
            <span className="text-xs font-bold text-accent-cyan uppercase tracking-widest">{dateLabel}</span>
          </div>

          {/* Pasos de hoy (Garmin) */}
          {steps && <StepsCard steps={steps.steps} goal={steps.goal} />}

          {/* Rutina del día */}
          {initialTodayRoutine && (
            <GymRoutineCard routine={initialTodayRoutine} onStarted={handleLogged} />
          )}

          {/* Entrenamientos de hoy (cardio completado) */}
          {todayWorkouts.length > 0 && (
            <TodayWorkoutCard
              workouts={todayWorkouts}
              onDeleted={handleWorkoutDeleted}
              isRefreshing={isRefreshing}
            />
          )}

          {/* Empezar workout vacío → pantalla de sesión activa */}
          <button
            onClick={() => router.push("/fitness/session")}
            className="w-full py-3 rounded-full bg-accent-cyan text-[#0D0F14] font-bold text-sm flex items-center justify-center gap-2 active:scale-95 transition-all"
          >
            <span className="material-symbols-outlined text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
              add
            </span>
            Empezar workout vacío
          </button>

          {/* NLP Quick Log */}
          <FitnessQuickActions onLogged={handleLogged} />

          {/* Garmin sync */}
          <GarminSyncButton
            garminStatus={{ connected: garminConnected, sessionValid: garminConnected, lastSync: null }}
            onSynced={handleLogged}
          />
        </div>
      )}

      {/* ── STATS ─────────────────────────────────────────────── */}
      {tab === "stats" && (
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-on-surface tracking-tight">Analysis</h2>
          <WeeklyVolumeChart data={weeklyStats} />
          <div className="space-y-2">
            <h3 className="text-xs font-bold text-on-surface-variant uppercase tracking-widest px-1">
              Últimos 14 días
            </h3>
            <WorkoutHistoryList workouts={history} onDeleted={handleWorkoutDeleted} />
          </div>
        </div>
      )}
    </div>
  );
}
