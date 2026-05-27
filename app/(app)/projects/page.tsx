// ============================================================
// /projects — Solo proyectos activos (sin kanban ni tareas)
// El tablero operativo está en /tasks
// ============================================================

import { FolderKanban } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getAllProjects } from "@/lib/projects";
import ActiveProjectsList from "@/components/projects/ActiveProjectsList";

export default async function ProjectsPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const projects = await getAllProjects(userId).catch(() => []);

  // Solo activos: TODO e IN_PROGRESS
  const activeProjects = projects.filter(
    (p) => p.status === "TODO" || p.status === "IN_PROGRESS"
  );

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <FolderKanban className="w-5 h-5 text-module-projects" />
          <h2 className="text-xl font-bold text-on-surface">Proyectos</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Proyectos activos · El tablero está en{" "}
          <a href="/tasks" className="text-amber-400 hover:underline">
            Tareas
          </a>
        </p>
      </div>

      <ActiveProjectsList initialProjects={activeProjects} />
    </div>
  );
}
