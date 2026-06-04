import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getActivityBySlug } from "@/lib/fitness-activities";
import {
  getActivityWeekSummary,
  getLastActivityOfType,
  getActivityHistory,
  getTodaySteps,
} from "@/lib/fitness";
import ActivityPageClient from "@/components/fitness/ActivityPageClient";

export default async function ActivityPage({
  params,
}: {
  params: Promise<{ actividad: string }>;
}) {
  const { actividad } = await params;
  const activity = getActivityBySlug(actividad);
  if (!activity || activity.type === "GYM") notFound(); // gym tiene su propia ruta

  const session = await auth();
  if (!session?.user?.id) notFound();
  const userId = session.user.id;

  const [last, week, history, stepsInfo] = await Promise.all([
    getLastActivityOfType(userId, activity.type),
    getActivityWeekSummary(userId, activity.type),
    getActivityHistory(userId, activity.type),
    activity.type === "WALKING" ? getTodaySteps(userId) : Promise.resolve(null),
  ]);

  return (
    <ActivityPageClient
      activity={activity}
      last={last}
      week={week}
      history={history}
      steps={stepsInfo?.steps}
      goal={stepsInfo?.goal}
    />
  );
}
