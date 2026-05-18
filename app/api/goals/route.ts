// ============================================================
// GET  /api/goals   — obtener objetivos del usuario
// PATCH /api/goals  — actualizar objetivos + notificar agentes
//
// Flujo PATCH:
//   1. Guardar en DB
//   2. Notificar a todos los agentes en paralelo
//   3. Esperar todos los OK (Promise.allSettled)
//   4. Enviar WhatsApp con confirmación
// ============================================================

import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { getGoals, upsertGoals, notifyAgentsGoalsUpdated, goalsUpdateSummary } from "@/lib/goals";
import { sendTextMessage } from "@/lib/whatsapp";
import { db } from "@/lib/db";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const goals = await getGoals(session.user.id);
  return NextResponse.json(goals);
}

export async function PATCH(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json();
  const userId = session.user.id;

  // Whitelist de campos permitidos
  const allowed = [
    "sleepTargetHours", "sleepTargetBedTime", "sleepTargetWakeTime",
    "fitnessCurrentWeight", "fitnessTargetWeight", "fitnessTargetBodyFat",
    "fitnessTargetGymDuration", "fitnessTargetCardioWeekly",
    "nutritionTargetCalories", "nutritionTargetProtein",
    "nutritionTargetCarbs", "nutritionTargetFat",
    "financesMonthlyIncome", "financesMonthlyTarget", "financesMonthlyBudget",
    "projectsTargetTasksPerWeek",
    "weightSleep", "weightFitness", "weightNutrition",
    "weightFinances", "weightProjects",
  ];

  const input = Object.fromEntries(
    Object.entries(body).filter(([k]) => allowed.includes(k))
  );

  // 1. Guardar en DB
  const goals = await upsertGoals(userId, input);

  // 2. Notificar a todos los agentes en paralelo
  const agentResults = await notifyAgentsGoalsUpdated(userId, goals);
  const allOk = agentResults.every((r) => r.ok);
  const failedAgents = agentResults.filter((r) => !r.ok).map((r) => r.agent);

  // 3. Enviar WhatsApp al usuario con el resultado
  const settings = await db.userSettings.findUnique({ where: { userId } });
  if (settings?.whatsappNumber && settings?.notificationsEnabled) {
    const summary = goalsUpdateSummary(goals);
    const statusLine = allOk
      ? "✅ Objetivos actualizados en todos los módulos."
      : `⚠️ Objetivos guardados. Error en: ${failedAgents.join(", ")}.`;

    await sendTextMessage(
      settings.whatsappNumber,
      `${statusLine}\n\n${summary}`
    ).catch(() => null); // No fallar si WA falla
  }

  return NextResponse.json({
    goals,
    agents: agentResults,
    allOk,
  });
}
