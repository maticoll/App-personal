// GET /api/finances/summary
// Proxy server-side para obtener el dashboard de finanzas.
// La API key nunca llega al cliente — se lee desde UserSettings en el servidor.

import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { getFinancesDashboard } from "@/lib/finances";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "No autenticado" }, { status: 401 });
  }

  const data = await getFinancesDashboard(session.user.id);
  return NextResponse.json({ ok: true, ...data });
}
