// ============================================================
// Módulo de Proyectos — /projects — Sesión 6
// Server Component: carga datos iniciales en paralelo
// ============================================================

import { FolderKanban } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllProjects, getWeeklyStats } from "@/lib/projects";
import ProjectsModuleClient from "@/components/projects/ProjectsModuleClient";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [projects, stats] = await Promise.all([
    getAllProjects(userId).catch(() => []),
    getWeeklyStats(userId).catch(() => ({
      projectsAdvanced: 0,
      tasksCompleted: 0,
      activeProjects: 0,
    })),
  ]);

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban className="w-5 h-5 text-module-projects" />
          <h2 className="text-xl font-bold text-[var(--text-primary)]">Proyectos</h2>
        </div>
        <p className="text-sm text-[var(--text-secondary)]">
          Personales, trabajo y deadlines
        </p>
      </div>

      <ProjectsModuleClient initialProjects={projects} initialStats={stats} />
    </div>
  );
}
