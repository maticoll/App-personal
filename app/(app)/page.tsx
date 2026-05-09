// ============================================================
// Dashboard Principal — /
// Sesión 2 — Score global, barras por módulo, resúmenes
// ============================================================

import { auth } from "@/auth";
import { Moon, Dumbbell, Salad, FolderKanban, Lightbulb, Wallet, BarChart3, RefreshCw } from "lucide-react";
import Link from "next/link";
import { ScoringDashboard } from "@/components/scoring/ScoringDashboard";
import { ModuleSummaryCard } from "@/components/dashboard/ModuleSummaryCard";
import { db } from "@/lib/db";
import { calculateFullScore, saveScore, getStoredScore } from "@/lib/scoring";
import type { DailyScoreData } from "@/lib/types";

// -------------------------------------------------------
// Cargar el score del día (calcula si no existe)
// -------------------------------------------------------

async function loadTodayScore(userId: string): Promise<DailyScoreData | null> {
  const today = new Date();

  // Intentar leer el guardado primero (más rápido)
  const stored = await getStoredScore(userId, today);
  if (stored) return stored;

  // Calcular y guardar
  try {
    const result = await calculateFullScore(userId, today);
    await saveScore(userId, today, result);
    return {
      sleep: result.sleep.score,
      fitness: result.fitness.score,
      nutrition: result.nutrition.score,
      projects: result.projects.score,
      global: result.global,
      date: today,
      details: {
        sleep: { met: result.sleep.met, missed: result.sleep.missed },
        fitness: { met: result.fitness.met, missed: result.fitness.missed },
        nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
        projects: { met: result.projects.met, missed: result.projects.missed },
      },
    };
  } catch {
    return null;
  }
}

// -------------------------------------------------------
// Cargar resúmenes rápidos de módulos (mock + real mixto)
// -------------------------------------------------------

async function loadModuleSummaries(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endToday = new Date(today);
  endToday.setHours(23, 59, 59, 999);

  const [sleepLog, workouts, meals, waterLogs, activeProjects, recentIdeas] =
    await Promise.all([
      db.sleepLog
        .findUnique({ where: { userId_date: { userId, date: today } } })
        .catch(() => null),
      db.workout
        .findMany({ where: { userId, date: { gte: today, lte: endToday } } })
        .catch(() => []),
      db.meal
        .findMany({ where: { userId, date: today } })
        .catch(() => []),
      db.waterLog
        .findMany({ where: { userId, date: today } })
        .catch(() => []),
      db.project
        .findMany({ where: { userId, status: "IN_PROGRESS" }, take: 3 })
        .catch(() => []),
      db.idea
        .findMany({
          where: { userId },
          orderBy: { createdAt: "desc" },
          take: 3,
        })
        .catch(() => []),
    ]);

  // Sleep summary
  const sleepSummary = sleepLog
    ? sleepLog.durationMinutes
      ? `${Math.floor(sleepLog.durationMinutes / 60)}h ${sleepLog.durationMinutes % 60}min`
      : "Registrado · sin despertar"
    : "Sin datos hoy";

  // Fitness summary
  const fitnessSummary =
    workouts.length > 0
      ? workouts.map((w) => w.type).join(" · ")
      : "Sin actividad registrada";

  const fitnessBadge =
    workouts.length > 0
      ? workouts.some((w) => w.type === "GYM")
        ? "🏋️ Gym"
        : "✅ Activo"
      : undefined;

  // Nutrition summary
  const mealCount = meals.length;
  const waterTotal = waterLogs.reduce((acc, w) => acc + w.thermos, 0);
  const nutritionSummary =
    mealCount > 0
      ? `${mealCount} comida${mealCount > 1 ? "s" : ""} · 💧 ${waterTotal.toFixed(1)} termos`
      : "Sin comidas registradas";

  // Projects summary
  const projectsSummary =
    activeProjects.length > 0
      ? `${activeProjects.length} en progreso`
      : "Sin proyectos activos";

  // Ideas summary
  const ideasSummary =
    recentIdeas.length > 0
      ? `${recentIdeas.length} idea${recentIdeas.length > 1 ? "s" : ""} reciente${recentIdeas.length > 1 ? "s" : ""}`
      : "Sin ideas registradas";

  return {
    sleep: sleepSummary,
    fitness: fitnessSummary,
    fitnessBadge,
    nutrition: nutritionSummary,
    projects: projectsSummary,
    ideas: ideasSummary,
  };
}

// -------------------------------------------------------
// Página principal
// -------------------------------------------------------

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? "Corea";

  // Cargar datos en paralelo
  const [todayScore, summaries] = await Promise.all([
    userId ? loadTodayScore(userId) : Promise.resolve(null),
    userId ? loadModuleSummaries(userId) : Promise.resolve(null),
  ]);

  const now = new Date();
  const hora = now.getHours();
  const saludo =
    hora < 12 ? "Buenos días" : hora < 19 ? "Buenas tardes" : "Buenas noches";

  const dateLabel = now.toLocaleDateString("es-AR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="space-y-6 animate-fade-in">

      {/* ─── Saludo ──────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-[var(--text-primary)]">
            {saludo}, {firstName} 👋
          </h2>
          <p className="text-[var(--text-secondary)] text-sm mt-1 capitalize">
            {dateLabel}
          </p>
        </div>

        {/* Botón recalcular score */}
        <Link
          href="/api/scoring/calculate"
          className="flex items-center gap-1.5 text-xs text-[var(--text-muted)] hover:text-[var(--text-secondary)] transition-colors pt-1"
          title="Recalcular score"
        >
          <RefreshCw className="w-3.5 h-3.5" />
        </Link>
      </div>

      {/* ─── Score del día ────────────────────────────────────── */}
      <div className="card space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="w-5 h-5 text-accent" />
            <span className="font-semibold text-[var(--text-primary)]">
              Score del día
            </span>
          </div>
          <Link
            href="/scoring"
            className="text-xs text-[var(--text-muted)] hover:text-accent transition-colors"
          >
            Ver historial →
          </Link>
        </div>

        {/* Scoring dashboard: anillo + cards expandibles */}
        <ScoringDashboard todayScore={todayScore} />
      </div>

      {/* ─── Resúmenes rápidos de módulos ────────────────────── */}
      <div>
        <h3 className="text-sm font-medium text-[var(--text-secondary)] mb-3">
          Módulos
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">

          <ModuleSummaryCard
            href="/sleep"
            label="Sueño"
            icon={Moon}
            color="text-module-sleep"
            bgColor="bg-purple-500/10"
            score={todayScore?.sleep ?? null}
            summary={summaries?.sleep ?? "Sin datos hoy"}
          />

          <ModuleSummaryCard
            href="/fitness"
            label="Fitness"
            icon={Dumbbell}
            color="text-module-fitness"
            bgColor="bg-cyan-500/10"
            score={todayScore?.fitness ?? null}
            summary={summaries?.fitness ?? "Sin actividad registrada"}
            badge={summaries?.fitnessBadge}
          />

          <ModuleSummaryCard
            href="/nutrition"
            label="Nutrición"
            icon={Salad}
            color="text-module-nutrition"
            bgColor="bg-emerald-500/10"
            score={todayScore?.nutrition ?? null}
            summary={summaries?.nutrition ?? "Sin comidas registradas"}
          />

          <ModuleSummaryCard
            href="/projects"
            label="Proyectos"
            icon={FolderKanban}
            color="text-module-projects"
            bgColor="bg-amber-500/10"
            score={todayScore?.projects ?? null}
            summary={summaries?.projects ?? "Sin proyectos activos"}
          />

          <ModuleSummaryCard
            href="/ideas"
            label="Ideas"
            icon={Lightbulb}
            color="text-module-ideas"
            bgColor="bg-pink-500/10"
            score={null}
            summary={summaries?.ideas ?? "Sin ideas registradas"}
          />

          {/* Finanzas — sin score */}
          <Link
            href="/finances"
            className="card hover:bg-[var(--surface-hover)] active:scale-[0.98] transition-all duration-150 block"
          >
            <div className="space-y-3">
              <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-blue-500/10">
                <Wallet className="w-5 h-5 text-module-finances" />
              </div>
              <div>
                <p className="font-medium text-[var(--text-primary)] text-sm">Finanzas</p>
                <p className="text-xs text-[var(--text-muted)] mt-0.5">Ver app →</p>
              </div>
            </div>
          </Link>

        </div>
      </div>

    </div>
  );
}
