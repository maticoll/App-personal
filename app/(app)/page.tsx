// ============================================================
// Dashboard Principal — /
// Diseño Stitch: score ring + bento grid 2×3 de módulos
// ============================================================

import { auth } from "@/auth";
import Link from "next/link";
import { GlobalScoreRing } from "@/components/scoring/GlobalScoreRing";
import { db } from "@/lib/db";
import { calculateFullScore, saveScore, getStoredScore } from "@/lib/scoring";
import type { DailyScoreData } from "@/lib/types";

// ── Módulos del bento grid ────────────────────────────────────────────────────

const MODULES = [
  {
    href: "/sleep",
    label: "Sleep",
    icon: "bedtime",
    color: "#d0bcff",
    key: "sleep" as const,
  },
  {
    href: "/fitness",
    label: "Fitness",
    icon: "fitness_center",
    color: "#22d3ee",
    key: "fitness" as const,
  },
  {
    href: "/nutrition",
    label: "Nutrition",
    icon: "restaurant",
    color: "#10b981",
    key: "nutrition" as const,
  },
  {
    href: "/projects",
    label: "Projects",
    icon: "list_alt",
    color: "#fbbf24",
    key: "projects" as const,
  },
  {
    href: "/ideas",
    label: "Ideas",
    icon: "psychology",
    color: "#fb7185",
    key: "ideas" as const,
  },
  {
    href: "/finances",
    label: "Finances",
    icon: "payments",
    color: "#60a5fa",
    key: "finances" as const,
  },
] as const;

// ── Carga de datos ────────────────────────────────────────────────────────────

async function loadTodayScore(userId: string): Promise<DailyScoreData | null> {
  const today = new Date();
  const stored = await getStoredScore(userId, today);
  if (stored) return stored;
  try {
    const result = await calculateFullScore(userId, today);
    await saveScore(userId, today, result);
    return {
      sleep:     result.sleep.score,
      fitness:   result.fitness.score,
      nutrition: result.nutrition.score,
      projects:  result.projects.score,
      finances:  result.finances.score,
      global:    result.global,
      date:      today,
      details: {
        sleep:     { met: result.sleep.met,     missed: result.sleep.missed },
        fitness:   { met: result.fitness.met,   missed: result.fitness.missed },
        nutrition: { met: result.nutrition.met, missed: result.nutrition.missed },
        projects:  { met: result.projects.met,  missed: result.projects.missed },
        finances:  { met: result.finances.met,  missed: result.finances.missed },
      },
    };
  } catch {
    return null;
  }
}

async function loadSummaries(userId: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const endToday = new Date(today);
  endToday.setHours(23, 59, 59, 999);

  const [sleepLog, workouts, meals, waterLogs, activeProjects, recentIdeas] =
    await Promise.all([
      db.sleepLog.findUnique({ where: { userId_date: { userId, date: today } } }).catch(() => null),
      db.workout.findMany({ where: { userId, date: { gte: today, lte: endToday } } }).catch(() => []),
      db.meal.findMany({ where: { userId, date: today } }).catch(() => []),
      db.waterLog.findMany({ where: { userId, date: today } }).catch(() => []),
      db.project.findMany({ where: { userId, status: "IN_PROGRESS" }, take: 3 }).catch(() => []),
      db.idea.findMany({ where: { userId }, orderBy: { createdAt: "desc" }, take: 3 }).catch(() => []),
    ]);

  const waterTotal = waterLogs.reduce((acc: number, w: any) => acc + w.thermos, 0);

  return {
    sleep: sleepLog?.durationMinutes
      ? `${Math.floor(sleepLog.durationMinutes / 60)}h ${sleepLog.durationMinutes % 60}min`
      : "Sin datos",
    fitness: workouts.length > 0 ? `${workouts.length} actividad${workouts.length > 1 ? "es" : ""}` : "Sin actividad",
    nutrition: meals.length > 0 ? `${meals.length} comidas · ${waterTotal.toFixed(1)}L` : "Sin comidas",
    projects: activeProjects.length > 0 ? `${activeProjects.length} en progreso` : "Sin proyectos",
    ideas: recentIdeas.length > 0 ? `${recentIdeas.length} recientes` : "Sin ideas",
    finances: "Ver resumen →",
  };
}

// ── Página ────────────────────────────────────────────────────────────────────

export default async function DashboardPage() {
  const session = await auth();
  const userId = session?.user?.id;
  const firstName = session?.user?.name?.split(" ")[0] ?? "Corea";

  const [todayScore, summaries] = await Promise.all([
    userId ? loadTodayScore(userId) : Promise.resolve(null),
    userId ? loadSummaries(userId) : Promise.resolve(null),
  ]);

  const hora = new Date().getHours();
  const saludo = hora < 12 ? "Buenos dias" : hora < 19 ? "Buenas tardes" : "Buenas noches";
  const emoji = hora < 12 ? "☀️" : hora < 19 ? "\U0001f324️" : "\U0001f319";

  const dateLabel = new Date().toLocaleDateString("es-UY", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="animate-fade-in">

      {/* Saludo */}
      <section className="mb-10">
        <h1 className="text-2xl font-bold text-on-surface tracking-tight">
          {saludo}, {firstName} {emoji}
        </h1>
        <p className="text-sm text-on-surface-variant mt-0.5 capitalize">{dateLabel}</p>
      </section>

      {/* Score Ring */}
      <section className="flex flex-col items-center mb-10">
        <GlobalScoreRing score={todayScore?.global ?? null} size="lg" />
      </section>

      {/* Bento Grid 2x3 */}
      <div className="grid grid-cols-2 gap-3 mb-10">
        {MODULES.map(({ href, label, icon, color, key }) => {
          const score =
            key === "sleep" ? todayScore?.sleep :
            key === "fitness" ? todayScore?.fitness :
            key === "nutrition" ? todayScore?.nutrition :
            key === "projects" ? todayScore?.projects :
            key === "finances" ? todayScore?.finances :
            null;

          const summary = summaries?.[key as keyof typeof summaries] ?? "—";

          return (
            <Link
              key={href}
              href={href}
              className="glass-card rounded-2xl p-4 flex flex-col justify-between aspect-square active:scale-[0.97] transition-all duration-150"
            >
              <div className="flex justify-between items-start">
                <span
                  className="text-[11px] font-bold uppercase tracking-widest"
                  style={{ color }}
                >
                  {label}
                </span>
                <span
                  className="material-symbols-outlined text-[22px]"
                  style={{ color }}
                >
                  {icon}
                </span>
              </div>
              <div>
                {score !== null && score !== undefined ? (
                  <h3 className="text-2xl font-bold text-on-surface leading-none">
                    {score}
                    <span className="text-sm font-normal text-on-surface-variant ml-1">/100</span>
                  </h3>
                ) : (
                  <h3 className="text-xl font-semibold text-on-surface leading-none">&mdash;</h3>
                )}
                <p className="text-[11px] text-on-surface-variant mt-1.5 leading-snug line-clamp-2">
                  {summary}
                </p>
              </div>
            </Link>
          );
        })}
      </div>

      {/* Garmin Sync */}
      <div className="flex justify-center">
        <Link
          href="/sleep"
          className="bg-surface-container-highest px-6 py-3 rounded-full flex items-center gap-2 border border-outline-variant/20 hover:bg-surface-bright transition-colors active:scale-95 duration-150"
        >
          <span className="material-symbols-outlined text-primary text-[20px]">sync</span>
          <span className="text-sm font-medium text-on-surface">Sync con Garmin</span>
        </Link>
      </div>

    </div>
  );
}
