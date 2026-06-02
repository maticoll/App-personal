// ============================================================
// Módulo de Fitness — /fitness
// Server Component — carga datos iniciales en paralelo
// ============================================================

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Dumbbell } from "lucide-react";
import {
  getTodayWorkouts,
  getWorkoutHistory,
  getWeeklyStats,
  getTodayGymRoutine,
  checkSmartHabitDeviation,
  getTodaySteps,
} from "@/lib/fitness";
import { checkGarminStatus } from "@/lib/garmin";
import FitnessModuleClient from "@/components/fitness/FitnessModuleClient";

export default async function FitnessPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Carga paralela de todos los datos iniciales
  const [
    todayWorkouts,
    history,
    weeklyStats,
    todayRoutine,
    smartHabit,
    garminStatus,
    todaySteps,
  ] = await Promise.all([
    getTodayWorkouts(userId).catch(() => []),
    getWorkoutHistory(userId, 14).catch(() => []),
    getWeeklyStats(userId).catch(() => []),
    getTodayGymRoutine(userId).catch(() => null),
    checkSmartHabitDeviation(userId).catch(() => ({ shouldNotify: false, message: null })),
    checkGarminStatus(userId).catch(() => ({ connected: false })),
    getTodaySteps(userId).catch(() => null),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Dumbbell className="w-5 h-5 text-module-fitness" />
          <h2 className="text-xl font-bold text-on-surface">Fitness</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Gym, running, natación y actividad física
        </p>
      </div>

      {/* Client wrapper con toda la interactividad */}
      <FitnessModuleClient
        initialTodayWorkouts={todayWorkouts}
        initialHistory={history}
        initialWeeklyStats={weeklyStats}
        initialTodayRoutine={todayRoutine}
        initialSmartHabit={smartHabit}
        initialSteps={todaySteps}
        garminConnected={garminStatus.connected}
      />
    </div>
  );
}
