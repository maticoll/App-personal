import { CheckSquare } from "lucide-react";
import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getThisWeekTasks, getCompletedTasks } from "@/lib/tasks";
import { getAllProjects, getWeeklyStats } from "@/lib/projects";
import TasksPageClient from "@/components/tasks/TasksPageClient";

export default async function TasksPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = session.user.id;

  const [tasks, completedTasks, projects, stats] = await Promise.all([
    getThisWeekTasks(userId).catch(() => []),
    getCompletedTasks(userId, "this_week").catch(() => []),
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
          <CheckSquare className="w-5 h-5 text-amber-400" />
          <h2 className="text-xl font-bold text-on-surface">Tareas</h2>
        </div>
        <p className="text-sm text-on-surface-variant">
          Pendientes, tablero y registro
        </p>
      </div>

      <TasksPageClient
        initialTasks={tasks}
        initialCompletedTasks={completedTasks}
        initialProjects={projects}
        initialStats={stats}
      />
    </div>
  );
}
