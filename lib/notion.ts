// ============================================================
// lib/notion.ts — Integración Notion API (READ-ONLY)
// Sesión 6 — Pull de tareas IT desde base de datos de Notion
// ============================================================

import { Client } from "@notionhq/client";
import type { PageObjectResponse } from "@notionhq/client";
import { db } from "@/lib/db";
import type { ProjectStatus } from "@prisma/client";

// -------------------------------------------------------
// Tipos
// -------------------------------------------------------

export type NotionTask = {
  notionId: string;
  title: string;
  status: ProjectStatus;
  deadline?: Date;
};

export type NotionSyncResult = {
  synced: number;
  created: number;
  updated: number;
  errors: string[];
};

// -------------------------------------------------------
// Cliente Notion
// -------------------------------------------------------

export function getNotionClient(token: string): Client {
  return new Client({ auth: token });
}

// -------------------------------------------------------
// Mapeo de status de Notion → ProjectStatus
// -------------------------------------------------------

function mapNotionStatus(statusName: string | undefined): ProjectStatus {
  if (!statusName) return "TODO";

  const lower = statusName.toLowerCase();

  if (
    lower.includes("in progress") ||
    lower.includes("doing") ||
    lower === "en progreso"
  ) {
    return "IN_PROGRESS";
  }

  if (
    lower.includes("done") ||
    lower.includes("completed") ||
    lower.includes("completado") ||
    lower.includes("hecho")
  ) {
    return "DONE";
  }

  return "TODO";
}

// -------------------------------------------------------
// Extraer texto de una propiedad Title de Notion
// -------------------------------------------------------

function extractTitle(page: PageObjectResponse): string {
  const titleProp = Object.values(page.properties).find(
    (p) => p.type === "title"
  );
  if (!titleProp || titleProp.type !== "title") return "Sin título";

  return titleProp.title.map((t) => t.plain_text).join("") || "Sin título";
}

// -------------------------------------------------------
// Extraer status de Notion (busca propiedad de tipo "status" o "select")
// -------------------------------------------------------

function extractStatus(page: PageObjectResponse): string | undefined {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "status" && prop.status?.name) {
      return prop.status.name;
    }
    if (prop.type === "select" && prop.select?.name) {
      return prop.select.name;
    }
  }
  return undefined;
}

// -------------------------------------------------------
// Extraer deadline (busca propiedad de tipo "date")
// -------------------------------------------------------

function extractDeadline(page: PageObjectResponse): Date | undefined {
  for (const prop of Object.values(page.properties)) {
    if (prop.type === "date" && prop.date?.start) {
      return new Date(prop.date.start);
    }
  }
  return undefined;
}

// -------------------------------------------------------
// Fetch de todas las páginas de la DB de Notion
// -------------------------------------------------------

export async function fetchNotionTasks(
  token: string,
  databaseId: string
): Promise<NotionTask[]> {
  const client = getNotionClient(token);
  const tasks: NotionTask[] = [];

  let cursor: string | undefined = undefined;

  do {
    const response = await client.dataSources.query({
      data_source_id: databaseId,
      start_cursor: cursor,
      page_size: 100,
    });

    for (const page of response.results) {
      if (page.object !== "page") continue;
      const fullPage = page as PageObjectResponse;

      tasks.push({
        notionId: fullPage.id,
        title: extractTitle(fullPage),
        status: mapNotionStatus(extractStatus(fullPage)),
        deadline: extractDeadline(fullPage),
      });
    }

    cursor = response.has_more ? (response.next_cursor ?? undefined) : undefined;
  } while (cursor);

  return tasks;
}

// -------------------------------------------------------
// Sync: Notion → Projects (upsert por notionId)
// -------------------------------------------------------

export async function syncNotionToProjects(userId: string): Promise<NotionSyncResult> {
  const result: NotionSyncResult = {
    synced: 0,
    created: 0,
    updated: 0,
    errors: [],
  };

  // Leer credenciales desde UserSettings con fallback a env
  const settings = await db.userSettings.findUnique({
    where: { userId },
    select: { notionToken: true, notionDbId: true },
  });

  const token = settings?.notionToken ?? process.env.NOTION_TOKEN;
  const databaseId = settings?.notionDbId ?? process.env.NOTION_DB_ID;

  if (!token || !databaseId) {
    result.errors.push("Notion no configurado");
    return result;
  }

  let tasks: NotionTask[];
  try {
    tasks = await fetchNotionTasks(token, databaseId);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    result.errors.push(`Error al leer Notion: ${message}`);
    return result;
  }

  // Obtener el order máximo actual para nuevos proyectos
  const maxOrderAgg = await db.project.aggregate({
    where: { userId },
    _max: { order: true },
  });
  let nextOrder = (maxOrderAgg._max.order ?? 0) + 1;

  for (const task of tasks) {
    try {
      const existing = await db.project.findUnique({
        where: { notionId: task.notionId },
      });

      if (existing) {
        if (existing.userId === userId) {
          await db.project.update({
            where: { id: existing.id },
            data: {
              title: task.title,
              status: task.status,
              deadline: task.deadline ?? null,
            },
          });
          result.updated++;
        }
      } else {
        await db.project.create({
          data: {
            userId,
            title: task.title,
            status: task.status,
            deadline: task.deadline ?? null,
            notionId: task.notionId,
            color: "amber-600",
            order: nextOrder++,
          },
        });
        result.created++;
      }

      result.synced++;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Error desconocido";
      result.errors.push(`Error en tarea "${task.title}": ${message}`);
    }
  }

  return result;
}
