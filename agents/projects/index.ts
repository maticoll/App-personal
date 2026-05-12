// ============================================================
// Agente de Proyectos — agents/projects/index.ts
// Sesión 6 — NLP para CRUD de proyectos y tareas
// ============================================================

import {
  getAllProjects,
  createProject,
  updateProject,
  updateTask,
  getTodayProjectsSummary,
} from "@/lib/projects";
import { syncNotionToProjects } from "@/lib/notion";
import type { AgentInput, AgentOutput } from "@/lib/types";
import { detectIntentAI } from "@/lib/nlp";

// -------------------------------------------------------
// Normalización de texto (sin acentos, igual que otros agentes)
// -------------------------------------------------------

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .split("")
    .filter((c) => {
      const code = c.charCodeAt(0);
      return code < 0x0300 || code > 0x036f;
    })
    .join("");
}

// -------------------------------------------------------
// Detección de intención
// -------------------------------------------------------

type Intention =
  | "create"
  | "update_status"
  | "task_done"
  | "query"
  | "sync_notion"
  | "unknown";

async function detectIntention(text: string): Promise<Intention> {
  const intent = await detectIntentAI(
    "Eres el agente de proyectos de una app personal.",
    {
      create: "El usuario quiere crear un nuevo proyecto",
      update_status: "El usuario quiere cambiar el estado de un proyecto (en progreso, hecho, archivado)",
      task_done: "El usuario marco una tarea como completada o terminada",
      query: "El usuario pregunta por sus proyectos, tareas pendientes o estado general",
      sync_notion: "El usuario quiere sincronizar con Notion",
      unknown: "Otro mensaje no relacionado a proyectos",
    },
    text
  );
  return intent as Intention;
}

// -------------------------------------------------------
// Handlers por intención
// -------------------------------------------------------

async function handleCreate(userId: string, text: string): Promise<string> {
  const match = text.match(/(?:nuevo|crear?|agregar?)\s+proyecto[:\s]+(.+)/i);
  const title = match?.[1]?.trim();

  if (!title) {
    return "¿Cómo se llama el proyecto que querés crear?";
  }

  await createProject(userId, { title });
  return `✅ Proyecto "${title}" creado en la columna TODO.`;
}

async function handleUpdateStatus(userId: string, text: string): Promise<string> {
  const projects = await getAllProjects(userId);

  if (projects.length === 0) {
    return "No tenés proyectos creados.";
  }

  const n = normalize(text);

  let newStatus: "TODO" | "IN_PROGRESS" | "DONE" | "ARCHIVED" | null = null;
  if (/en progreso|empece|inicio|comenzar|in.progress/.test(n)) newStatus = "IN_PROGRESS";
  else if (/termin|complet|hecho|done|listo/.test(n)) newStatus = "DONE";
  else if (/archiv/.test(n)) newStatus = "ARCHIVED";
  else if (/todo|pendiente|por hacer/.test(n)) newStatus = "TODO";

  if (!newStatus) {
    return "No entendí el estado. Decime: en progreso, terminado, archivado o pendiente.";
  }

  let projectToUpdate = projects.find((p) =>
    normalize(text).includes(normalize(p.title))
  );

  if (!projectToUpdate) {
    if (projects.length === 1) {
      projectToUpdate = projects[0];
    } else {
      const activeProjects = projects.filter(
        (p) => p.status === "TODO" || p.status === "IN_PROGRESS"
      );
      if (activeProjects.length === 1) {
        projectToUpdate = activeProjects[0];
      } else {
        return `¿Cuál proyecto querés mover? Tenés: ${projects
          .slice(0, 3)
          .map((p) => `"${p.title}"`)
          .join(", ")}`;
      }
    }
  }

  await updateProject(userId, projectToUpdate.id, { status: newStatus });

  const statusLabel = {
    TODO: "Por hacer",
    IN_PROGRESS: "En progreso",
    DONE: "Terminado",
    ARCHIVED: "Archivado",
  }[newStatus];

  return `✅ "${projectToUpdate.title}" movido a ${statusLabel}.`;
}

async function handleTaskDone(userId: string, text: string): Promise<string> {
  const projects = await getAllProjects(userId);
  const n = normalize(text);

  let taskToUpdate: { id: string; title: string } | null = null;
  let projectTitle = "";

  for (const project of projects) {
    for (const task of project.tasks) {
      if (
        !task.done &&
        normalize(task.title)
          .split(" ")
          .some((word) => word.length > 3 && n.includes(word))
      ) {
        taskToUpdate = task;
        projectTitle = project.title;
        break;
      }
    }
    if (taskToUpdate) break;
  }

  if (!taskToUpdate) {
    const allTasks = projects.flatMap((p) =>
      p.tasks
        .filter((t) => !t.done)
        .map((t) => ({ ...t, projectTitle: p.title }))
    );

    if (allTasks.length === 0) {
      return "No tenés tareas pendientes en tus proyectos.";
    }

    return `¿Cuál tarea completaste? Las pendientes son:\n${allTasks
      .slice(0, 5)
      .map((t) => `• "${t.title}" (${t.projectTitle})`)
      .join("\n")}`;
  }

  await updateTask(userId, taskToUpdate.id, { done: true });
  return `✅ Tarea "${taskToUpdate.title}" marcada como completada en "${projectTitle}".`;
}

async function handleQuery(userId: string): Promise<string> {
  const projects = await getAllProjects(userId);

  if (projects.length === 0) {
    return 'No tenés proyectos creados. Creá uno con "nuevo proyecto: [nombre]".';
  }

  const byStatus = {
    TODO: projects.filter((p) => p.status === "TODO"),
    IN_PROGRESS: projects.filter((p) => p.status === "IN_PROGRESS"),
    DONE: projects.filter((p) => p.status === "DONE"),
  };

  const lines: string[] = ["📋 *Tus proyectos:*\n"];

  if (byStatus.IN_PROGRESS.length > 0) {
    lines.push(`*En progreso (${byStatus.IN_PROGRESS.length}):*`);
    byStatus.IN_PROGRESS.forEach((p) => {
      const doneCount = p.tasks.filter((t) => t.done).length;
      const total = p.tasks.length;
      const progress = total > 0 ? ` ${doneCount}/${total}` : "";
      lines.push(`  • ${p.title}${progress}`);
    });
    lines.push("");
  }

  if (byStatus.TODO.length > 0) {
    lines.push(`*Pendientes (${byStatus.TODO.length}):*`);
    byStatus.TODO.slice(0, 3).forEach((p) => lines.push(`  • ${p.title}`));
    if (byStatus.TODO.length > 3) {
      lines.push(`  ...y ${byStatus.TODO.length - 3} más`);
    }
    lines.push("");
  }

  if (byStatus.DONE.length > 0) {
    lines.push(`*Terminados: ${byStatus.DONE.length}* ✓`);
  }

  return lines.join("\n").trim();
}

async function handleSyncNotion(userId: string): Promise<string> {
  const result = await syncNotionToProjects(userId);

  if (result.errors.length > 0 && result.synced === 0) {
    return `❌ ${result.errors[0]}`;
  }

  const parts = [];
  if (result.created > 0) parts.push(`${result.created} creados`);
  if (result.updated > 0) parts.push(`${result.updated} actualizados`);

  if (parts.length === 0) {
    return "✅ Notion sincronizado — sin cambios nuevos.";
  }

  return `✅ Notion sincronizado: ${parts.join(", ")}.`;
}

// -------------------------------------------------------
// Función principal exportada
// -------------------------------------------------------

export async function processProjectsMessage(
  userId: string,
  text: string
): Promise<string> {
  const intention = await detectIntention(text);

  switch (intention) {
    case "create":
      return handleCreate(userId, text);
    case "update_status":
      return handleUpdateStatus(userId, text);
    case "task_done":
      return handleTaskDone(userId, text);
    case "query":
      return handleQuery(userId);
    case "sync_notion":
      return handleSyncNotion(userId);
    default:
      return (
        "No entendí. Podés decirme:\n" +
        '• "nuevo proyecto: [nombre]"\n' +
        '• "moví [proyecto] a en progreso"\n' +
        '• "terminé la tarea [nombre]"\n' +
        '• "mis proyectos"\n' +
        '• "sync notion"'
      );
  }
}

/**
 * Resumen compacto para el Morning Summary (Sesión 8)
 */
export async function getProjectsSummaryText(
  userId: string,
  _date?: Date
): Promise<string> {
  return getTodayProjectsSummary(userId);
}

// -------------------------------------------------------
// Objeto agente (compatible con interfaz del orquestrador)
// -------------------------------------------------------

export const projectsAgent = {
  name: "projects",
  description: "Gestiona proyectos personales y tareas de trabajo",

  async process(input: AgentInput): Promise<AgentOutput> {
    try {
      const response = await processProjectsMessage(input.userId, input.message);
      return { success: true, message: response };
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      return { success: false, message: `Error en módulo de proyectos: ${message}` };
    }
  },

  async syncNotion(userId: string): Promise<void> {
    await syncNotionToProjects(userId);
  },

  async calculateScore(userId: string, date: Date): Promise<number> {
    const { calcProjectsScoreForDate } = await import("@/lib/scoring");
    const result = await calcProjectsScoreForDate(userId, date);
    return result.score ?? 0;
  },
};
