"use server";

// ============================================================
// Server actions de la página de Configuración
// ============================================================

import { auth, signIn } from "@/auth";
import { revokeGoogleAccess } from "@/lib/calendar";

/**
 * Reconecta Google Calendar de forma robusta:
 *   1. Revoca el grant actual del lado de Google (mata el token viejo/muerto).
 *   2. Dispara el login con Google. Como auth.config usa prompt="consent" +
 *      access_type="offline", Google muestra el consentimiento desde cero y
 *      entrega un refresh_token NUEVO, que auth.ts persiste en la DB.
 *
 * Resultado: el usuario recupera el acceso a Calendar sin tener que revocar a
 * mano en myaccount.google.com ni cerrar sesión.
 */
export async function reconnectGoogleCalendar(): Promise<void> {
  const session = await auth();
  if (session?.user?.id) {
    await revokeGoogleAccess(session.user.id);
  }
  // signIn lanza el redirect a Google — debe ser lo último de la acción.
  await signIn("google", { redirectTo: "/settings" });
}
