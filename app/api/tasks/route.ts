import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { getThisWeekTasks, getCompletedTasks } from "@/lib/tasks";

export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const view = searchParams.get("view") ?? "this_week";
  const period = (searchParams.get("period") ?? "this_week") as
    | "this_week"
    | "last_week"
    | "this_month"
    | "all";

  if (view === "completed") {
    const tasks = await getCompletedTasks(session.user.id, period);
    return NextResponse.json({ tasks });
  }

  const tasks = await getThisWeekTasks(session.user.id);
  return NextResponse.json({ tasks });
}
