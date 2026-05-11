// ============================================================
// Módulo de Ideas — /ideas
// Server Component — carga datos iniciales en paralelo
// Sesión 5 — implementado
// ============================================================

import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { Lightbulb } from "lucide-react";
import { getAllIdeas, getIdeasStats } from "@/lib/ideas";
import IdeasModuleClient from "@/components/ideas/IdeasModuleClient";

export default async function IdeasPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  // Carga paralela de todos los datos iniciales
  const [ideas, stats] = await Promise.all([
    getAllIdeas(userId).catch(() => []),
    getIdeasStats(userId).catch(() => ({
      total: 0,
      thisWeek: 0,
      thisMonth: 0,
      topTags: [],
    })),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1">
          <Lightbulb className="w-5 h-5 text-module-ideas" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Ideas</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Capturá y desarrollá ideas con IA
        </p>
      </div>

      {/* Client wrapper con toda la interactividad */}
      <IdeasModuleClient initialIdeas={ideas} initialStats={stats} />
    </div>
  );
}
