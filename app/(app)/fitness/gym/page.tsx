import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { getGymStats, getActivityHistory } from "@/lib/fitness";
import GymPageClient from "@/components/fitness/GymPageClient";

export default async function GymPage() {
  const session = await auth();
  if (!session?.user?.id) notFound();
  const userId = session.user.id;

  const [stats, history] = await Promise.all([
    getGymStats(userId),
    getActivityHistory(userId, "GYM"),
  ]);

  return <GymPageClient stats={stats} history={history} />;
}
