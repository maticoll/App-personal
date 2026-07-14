// ============================================================
// Utilidad de autenticación para cron jobs
// Acepta:
//   - Authorization: Bearer $CRON_SECRET (Vercel Cron)
//   - x-cron-secret: $CRON_SECRET (cron-job.org — preferido)
//   - ?secret=$CRON_SECRET (deprecado: queda en logs de acceso y
//     analytics; migrar los jobs de cron-job.org al header y rotar
//     el secret)
// ============================================================

import { createHash, timingSafeEqual } from "crypto";

/**
 * Comparación en tiempo constante. Se hashean ambos lados para igualar
 * longitudes (timingSafeEqual exige buffers del mismo largo y cortar
 * antes filtraría la longitud del secret).
 */
function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  if (authHeader && safeEqual(authHeader, `Bearer ${secret}`)) return true;

  const cronHeader = request.headers.get("x-cron-secret");
  if (cronHeader && safeEqual(cronHeader, secret)) return true;

  let querySecret: string | null = null;
  try {
    const url = new URL(request.url);
    querySecret = url.searchParams.get("secret");
  } catch {
    // URL inválida — ignorar
  }
  if (querySecret && safeEqual(querySecret, secret)) {
    console.warn(
      "[cron] Auth por ?secret= (deprecado) — migrar este job al header x-cron-secret y rotar CRON_SECRET",
    );
    return true;
  }

  return false;
}
