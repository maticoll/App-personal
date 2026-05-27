import { auth } from "@/auth";
import { NextResponse } from "next/server";
import { toggleTask } from "@/lib/tasks";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();
  const { done } = body as { done: boolean };

  if (typeof done !== "boolean")
    return NextResponse.json({ error: "done must be boolean" }, { status: 400 });

  await toggleTask(id, session.user.id, done);
  return NextResponse.json({ ok: true });
}
