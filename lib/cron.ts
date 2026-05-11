// ============================================================
// Utilidad de autenticación para cron jobs
// Acepta:
//   - Authorization: Bearer $CRON_SECRET (Vercel Cron)
//   - x-cron-secret: $CRON_SECRET (cron-job.org con plan pago)
//   - ?secret=$CRON_SECRET (cron-job.org plan free — query param)
// ============================================================

export function verifyCronSecret(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;

  const authHeader = request.headers.get("authorization");
  const cronHeader = request.headers.get("x-cron-secret");

  let querySecret: string | null = null;
  try {
    const url = new URL(request.url);
    querySecret = url.searchParams.get("secret");
  } catch {
    // URL inválida — ignorar
  }

  return (
    authHeader === `Bearer ${secret}` ||
    cronHeader === secret ||
    querySecret === secret
  );
}
